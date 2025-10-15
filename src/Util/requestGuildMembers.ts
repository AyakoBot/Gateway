import { Worker } from 'worker_threads';

import { GatewayOpcodes } from 'discord-api-types/v10';
import { shardIdForGuildId } from 'discord-hybrid-sharding';

import { cache, gateway } from '../BaseClient/Bot/Client.js';
import type { Message, PassObject } from '../BaseClient/MemberWorker/Worker.js';

const spawnWorkerThread = async (guildId: string, shardId: number) => {
 const worker = new Worker('./dist/BaseClient/MemberWorker/Worker.js', {
  workerData: {
   guildId,
   shardId,
  } as PassObject,
 });

 let isReady: boolean = false;

 setTimeout(() => {
  if (isReady) return;
  worker.terminate();
  cache.requestingGuild = null;
  throw new Error(`Timed out waiting for worker to be ready for guild ${guildId}`);
 }, 60000);

 await new Promise((resolve, reject) => {
  worker.once('message', (result: Message) => {
   if (result.type === 'ready') {
    isReady = true;
    return;
   }

   resolve(void 0);
   worker.terminate();
   cache.requestingGuild = null;
   cache.requestedGuilds.add(result.guildId);
  });
  worker.once('error', (error: Message) => {
   reject();
   worker.terminate();
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
 cache.requestedGuilds.add(guildId);

 cache.requestingGuild = guildId;

 // eslint-disable-next-line no-console
 console.log('[CHUNK] Requesting guild members for', guildId);

 const shardId = shardIdForGuildId(guildId);

 await spawnWorkerThread(guildId, shardId);

 return gateway.send(shardId, {
  op: GatewayOpcodes.RequestGuildMembers,
  d: {
   guild_id: guildId,
   presences: false,
   limit: 0,
   query: '',
  },
 });
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
