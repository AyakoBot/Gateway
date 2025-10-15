/* eslint-disable no-console */
import { Worker } from 'worker_threads';

import { shardIdForGuildId } from 'discord-hybrid-sharding';

import { cache } from '../BaseClient/Bot/Client.js';
import type { Message, PassObject } from '../BaseClient/MemberWorker/Worker.js';

const runWorkerThread = async (guildId: string, shardId: number) => {
 console.log('[CHUNK] Spawning worker thread for', guildId);
 const worker = new Worker('./dist/BaseClient/MemberWorker/Worker.js', {
  argv: process.argv,
  // execArgv: ['--max-old-space-size=4096'], // 8192
  workerData: { guildId, shardId } as PassObject,
 });
 console.log(`[CHUNK] Worker spawned for guild ${guildId}`);

 let isReady: boolean = false;

 setTimeout(() => {
  if (worker.threadId === -1) return;

  worker.terminate();
  cache.requestingGuild = null;
  console.log(`[CHUNK] Worker timed out for guild ${guildId} - Ready state: ${isReady}`);
  throw new Error(`Timed out waiting for worker for guild ${guildId} - Ready state: ${isReady}`);
 }, 60000);

 await new Promise((resolve, reject) => {
  worker.on('message', (result: Message) => {
   if (result.type === 'ready') {
    console.log(`[CHUNK] Worker ready for guild ${guildId}`);
    isReady = true;
    return;
   }

   console.log(`[CHUNK] Worker finished for guild ${guildId}`);

   worker.terminate();
   cache.requestingGuild = null;
   cache.requestedGuilds.add(result.guildId);

   resolve(void 0);
  });
  worker.once('error', (error: Message) => {
   reject();
   worker.terminate();
   console.log(`[CHUNK] Worker errored for guild ${guildId}`);
   console.log(error);
   throw error;
  });
 });
};

const requestGuildMembers = async (guildId: string) => {
 if (cache.requestingGuild !== guildId && cache.requestingGuild) {
  cache.requestGuildQueue.add(guildId);
  return Promise.resolve();
 }

 if (cache.requestedGuilds.has(guildId)) return Promise.resolve();

 cache.requestingGuild = guildId;

 console.log('[CHUNK] Requesting guild members for', guildId);

 const shardId = shardIdForGuildId(guildId);

 await runWorkerThread(guildId, shardId);
};

setInterval(() => {
 if (cache.requestingGuild) return;
 if (cache.requestGuildQueue.size === 0) return;

 const [nextGuild] = [...cache.requestGuildQueue.values()]
  .map((id) => ({ id, members: cache.members.get(id) || 0 }))
  .sort((a, b) => b.members - a.members);

 if (!nextGuild) return;

 cache.requestGuildQueue.delete(nextGuild.id);
 requestGuildMembers(nextGuild.id);
}, 100);

export default requestGuildMembers;
