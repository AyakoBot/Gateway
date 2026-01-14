/* eslint-disable no-console */
import { getChannelPerms } from '@ayako/utility';
import { PermissionFlagsBits } from 'discord-api-types/v10';

import redis from '../BaseClient/Bot/Cache.js';
import { api, cache } from '../BaseClient/Bot/Client.js';

const requestChannelPins = async (channelId: string, guildId: string): Promise<void> => {
 if (!channelId || !guildId) return;

 if (cache.requestingPins === channelId) return;
 if (cache.requestPinsQueue.has(channelId)) return;

 const [alreadyRequested] = await redis.execPipeline<[string | null]>((pipeline) => {
  pipeline.hget('channel-pins-requested', channelId);
  pipeline.hset('channel-pins-requested', channelId, '1');
  pipeline.call('hexpire', 'channel-pins-requested', 300, 'NX', 'FIELDS', 1, channelId);
 });
 if (alreadyRequested === '1') return;

 cache.requestPinsQueue.add(channelId);
 cache.requestPinsGuildMap.set(channelId, guildId);

 console.log('[Pins] Added to queue:', channelId, '| Queue size:', cache.requestPinsQueue.size);
};

const processPinsRequest = async (channelId: string): Promise<void> => {
 const guildId = cache.requestPinsGuildMap.get(channelId);
 if (!guildId) {
  console.log('[Pins] No guild context for channel:', channelId);
  return;
 }

 const channelPerms = await getChannelPerms.call(redis, guildId, cache.user?.id || '0', channelId);
 const readPerms = PermissionFlagsBits.ViewAuditLog | PermissionFlagsBits.ReadMessageHistory;
 if ((channelPerms.allow & readPerms) !== readPerms) {
  console.log('[Pins] Missing permissions for channel:', channelId);
  return;
 }

 await redis.pins.delAll(channelId);

 try {
  const pins = await api.channels.getPins(channelId);

  pins.forEach((pin) => {
   redis.pins.set(channelId, pin.id);
   redis.messages.set(pin, guildId);
  });

  console.log('[Pins] Fetched', pins.length, 'pins for channel:', channelId);
 } catch (error: unknown) {
  if (isRateLimitError(error)) {
   const retryAfter = getRateLimitRetryAfter(error);
   console.log('[Pins] Rate limited, pausing for', retryAfter, 'ms');

   cache.requestPinsQueue.add(channelId);
   cache.requestPinsGuildMap.set(channelId, guildId);

   cache.requestPinsPaused = true;
   setTimeout(() => {
    cache.requestPinsPaused = false;
    console.log('[Pins] Resuming queue processing');
   }, retryAfter);

   return;
  }

  console.log('[Pins] Error fetching pins for channel:', channelId, error);
 }
};

const isRateLimitError = (error: unknown): boolean => {
 if (error && typeof error === 'object' && 'status' in error) {
  return (error as { status: number }).status === 429;
 }
 return false;
};

const getRateLimitRetryAfter = (error: unknown): number => {
 const DEFAULT_RETRY = 5000;

 if (error && typeof error === 'object') {
  if ('rawError' in error) {
   // eslint-disable-next-line @typescript-eslint/naming-convention
   const { rawError } = error as { rawError: { retry_after?: number } };
   if (rawError?.retry_after) {
    return Math.ceil(rawError.retry_after * 1000);
   }
  }
 }

 return DEFAULT_RETRY;
};

setInterval(async () => {
 if (cache.requestingPins) return;
 if (cache.requestPinsPaused) return;
 if (cache.requestPinsQueue.size === 0) return;

 const [nextChannelId] = cache.requestPinsQueue.values();
 if (!nextChannelId) return;

 cache.requestPinsQueue.delete(nextChannelId);
 cache.requestingPins = nextChannelId;

 console.log(
  '[Pins] Processing channel:',
  nextChannelId,
  '| Left in queue:',
  cache.requestPinsQueue.size,
 );

 try {
  await processPinsRequest(nextChannelId);
 } finally {
  cache.requestingPins = null;
  cache.requestPinsGuildMap.delete(nextChannelId);
 }
}, 500);

export default requestChannelPins;
