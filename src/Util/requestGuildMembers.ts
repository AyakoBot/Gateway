/* eslint-disable no-console */
import { type ChildProcess, fork } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { getInfo, shardIdForGuildId } from 'discord-hybrid-sharding';

import { cache } from '../BaseClient/Bot/Client.js';
import RedisCache from '../BaseClient/Bot/Redis.js';
import type { Message } from '../BaseClient/MemberWorker/Worker.js';

const filename = fileURLToPath(import.meta.url);

const exitHandler = (worker: ChildProcess) => {
 worker.kill();
};

const runWorkerThread = async (guildId: string, shardId: number) => {
 console.log('[CHUNK] Spawning child process for', guildId);
 const worker = fork(join(dirname(filename), '../BaseClient/MemberWorker/Worker.js'), [], {
  execArgv: [
   '--max-old-space-size=1024',
   process.env.argv?.includes('--dev') ? '--dev' : '',
  ].filter((v) => !!v.length),
  env: {
   guildId,
   shardId: String(shardId),
   totalShards: String(getInfo().TOTAL_SHARDS),
   token: (
    (process.argv.includes('--dev') ? process.env.DevToken : process.env.Token) ?? ''
   ).replace('Bot ', ''),
   cacheDB: process.env.cacheDB,
   devCacheDB: process.env.devCacheDB,
  },
 });
 console.log(`[CHUNK] Worker spawned for guild ${guildId}`);

 const boundHandler = () => exitHandler(worker);
 process.on('exit', boundHandler);
 process.on('SIGINT', boundHandler);
 process.on('SIGTERM', boundHandler);
 process.on('uncaughtException', boundHandler);

 let isReady: boolean = false;

 setTimeout(() => {
  if (worker.exitCode === null) return;

  worker.kill();

  process.off('exit', boundHandler);
  process.off('SIGINT', boundHandler);
  process.off('SIGTERM', boundHandler);
  process.off('uncaughtException', boundHandler);

  cache.requestGuildQueue.add(guildId);
  cache.requestingGuild = null;

  console.log(
   `[CHUNK] Worker timed out for guild ${guildId} - Ready state: ${isReady} - Exit code: ${worker.exitCode}`,
  );
  throw new Error(
   `Timed out waiting for worker for guild ${guildId} - Ready state: ${isReady} - Exit code: ${worker.exitCode}`,
  );
 }, 60000);

 await new Promise((resolve, reject) => {
  worker.on('message', (result: Message) => {
   if (result.type === 'ready') {
    console.log(`[CHUNK] Worker ready for guild ${guildId}`);
    isReady = true;
    return;
   }

   console.log(`[CHUNK] Worker finished for guild ${guildId}`);

   worker.kill();

   process.off('exit', boundHandler);
   process.off('SIGINT', boundHandler);
   process.off('SIGTERM', boundHandler);
   process.off('uncaughtException', boundHandler);

   cache.requestingGuild = null;

   const pipeline = RedisCache.pipeline();
   pipeline.hset('guild-members-requested', result.guildId, '1');
   pipeline.call('hexpire', 'guild-members-requested', 604800, 'NX', 'FIELDS', 1, result.guildId);
   pipeline.exec();

   resolve(void 0);
  });
  worker.once('error', (error: Message) => {
   reject();
   worker.kill();

   process.off('exit', boundHandler);
   process.off('SIGINT', boundHandler);
   process.off('SIGTERM', boundHandler);
   process.off('uncaughtException', boundHandler);

   console.log(`[CHUNK] Worker errored for guild ${guildId}`);
   console.log(error);

   cache.requestGuildQueue.add(guildId);
   throw error;
  });
 });
};

const requestGuildMembers = async (guildId: string) => {
 if (cache.requestingGuild !== guildId && cache.requestingGuild) {
  cache.requestGuildQueue.add(guildId);
  return Promise.resolve();
 }

 const isMember = await RedisCache.hget('guild-members-requested', guildId);
 if (isMember === '1') return Promise.resolve();

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
 console.log('[CHUNK] Left in queue:', cache.requestGuildQueue.size);
 requestGuildMembers(nextGuild.id);
}, 100);

export default requestGuildMembers;
