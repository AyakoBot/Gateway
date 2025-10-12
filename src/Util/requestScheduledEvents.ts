import { DiscordAPIError } from '@discordjs/rest';

import { api } from '../BaseClient/Bot/Client.js';
import RedisClient, { cache } from '../BaseClient/Bot/Redis.js';

const processing = new Set<string>();
const queue: Array<{ guildId: string; resolve: () => void }> = [];
let isProcessing = false;

const processNext = async () => {
 if (isProcessing || queue.length === 0) return;

 isProcessing = true;
 const item = queue.shift();
 if (!item) {
  isProcessing = false;
  return;
 }

 const { guildId, resolve } = item;

 const keystoreKey = cache.events.keystore(guildId);
 const keys = await RedisClient.hkeys(keystoreKey);
 if (keys.length > 0) await RedisClient.del(...keys, keystoreKey);

 api.guilds
  .getScheduledEvents(guildId, { with_user_count: true })
  .then((scheduledEvents) => {
   scheduledEvents.forEach((e) => cache.events.set(e));

   processing.delete(guildId);
   resolve();
   isProcessing = false;
   setImmediate(() => processNext());
  })
  .catch((error: DiscordAPIError) => {
   if (error.status === 429) {
    const retryAfter = error.retryAfter ?? 1000;
    // eslint-disable-next-line no-console
    console.log(`[EVENTS] Rate limited, retrying ${guildId} after ${retryAfter}ms`);
    setTimeout(() => {
     queue.unshift(item);
     isProcessing = false;
     processNext();
    }, retryAfter);
    return;
   }

   if ([401, 403, 404].includes(error.status)) {
    // eslint-disable-next-line no-console
    console.log(`[EVENTS] Aborting ${guildId} due to ${error.status}`);
    processing.delete(guildId);
    resolve();
    isProcessing = false;
    setImmediate(() => processNext());
    return;
   }

   // eslint-disable-next-line no-console
   console.error('[EVENTS] Error fetching scheduled events for', guildId, error);
   processing.delete(guildId);
   resolve();
   isProcessing = false;
   setImmediate(() => processNext());
  });
};

export default (guildId: string): Promise<void> => {
 if (processing.has(guildId)) return Promise.resolve();

 processing.add(guildId);

 return new Promise((resolve) => {
  queue.push({ guildId, resolve });
  processNext();
 });
};
