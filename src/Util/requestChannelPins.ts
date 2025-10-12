import type { DiscordAPIError } from '@discordjs/rest';

import { api } from '../BaseClient/Bot/Client.js';
import { cache } from '../BaseClient/Bot/Redis.js';

import checkPermission from './checkPermission.js';

const processing = new Set<string>();
const queue: Array<{ channelId: string; guildId: string; resolve: () => void }> = [];
let isProcessing = false;

const processNext = async () => {
 if (isProcessing || queue.length === 0) return;

 isProcessing = true;
 const item = queue.shift();
 if (!item) {
  isProcessing = false;
  return;
 }

 const { channelId, guildId, resolve } = item;

 try {
  const hasPermission = await checkPermission(guildId, ['ViewChannel', 'ReadMessageHistory']);
  if (!hasPermission) {
   processing.delete(channelId);
   resolve();
   isProcessing = false;
   setImmediate(() => processNext());
   return;
  }

  await cache.pins.delAll(channelId);
 } catch (error) {
  // eslint-disable-next-line no-console
  console.error('[PINS] Error in pre-fetch operations for', channelId, error);
  processing.delete(channelId);
  resolve();
  isProcessing = false;
  setImmediate(() => processNext());
  return;
 }

 api.channels
  .getPins(channelId)
  .then((pins) => {
   pins.forEach((pin) => {
    cache.pins.set(channelId, pin.id);
    cache.messages.set(pin, guildId);
   });

   processing.delete(channelId);
   resolve();
   isProcessing = false;
   setImmediate(() => processNext());
  })
  .catch((error: unknown) => {
   const apiError = error as { status?: number; retryAfter?: number };
   if (apiError.status === 429) {
    const retryAfter = apiError.retryAfter ?? 1000;
    // eslint-disable-next-line no-console
    console.log(`[PINS] Rate limited, retrying ${channelId} after ${retryAfter}ms`);
    setTimeout(() => {
     queue.unshift(item);
     isProcessing = false;
     processNext();
    }, retryAfter);
    return;
   }

   if (apiError.status && [401, 403, 404].includes(apiError.status)) {
    // eslint-disable-next-line no-console
    console.log(`[PINS] Aborting ${channelId} due to ${apiError.status}`);
    processing.delete(channelId);
    resolve();
    isProcessing = false;
    setImmediate(() => processNext());
    return;
   }

   // eslint-disable-next-line no-console
   console.error('[PINS] Error fetching pins for', channelId, error);
   processing.delete(channelId);
   resolve();
   isProcessing = false;
   setImmediate(() => processNext());
  });
};

export default (channelId: string, guildId: string): Promise<void> => {
 if (!guildId) return Promise.resolve();
 if (processing.has(channelId)) return Promise.resolve();

 processing.add(channelId);

 return new Promise((resolve) => {
  queue.push({ channelId, guildId, resolve });
  processNext();
 });
};
