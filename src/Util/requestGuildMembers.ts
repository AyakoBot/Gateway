import { getRandom } from '@ayako/utility';
import { GatewayOpcodes } from 'discord-api-types/gateway/v10';

import RedisCache from '../BaseClient/Bot/Cache.js';
import { cache, gateway } from '../BaseClient/Bot/Client.js';

import calculateShardId from './calculateShardId.js';

const requestGuildMembers = async (guildId: string) => {
 if (cache.requestingGuild !== guildId && cache.requestingGuild) {
  cache.requestGuildQueue.add(guildId);
  return;
 }

 cache.requestingGuild = guildId;

 const [isMember] = await RedisCache.execPipeline<[string | null]>((pipeline) => {
  pipeline.hget('guild-members-requested', guildId);
  pipeline.hset('guild-members-requested', guildId, '1');
  pipeline.call(
   'hexpire',
   'guild-members-requested',
   getRandom(604800 / 2, 604800),
   'NX',
   'FIELDS',
   1,
   guildId,
  );
 });

 if (isMember === '1') {
  cache.requestingGuild = null;
  return;
 }

 gateway.send(calculateShardId(guildId), {
  op: GatewayOpcodes.RequestGuildMembers,
  d: { guild_id: guildId, presences: false, limit: 0, query: '' },
 });
};

let isProcessingGuildQueue = false;

const processGuildQueue = async (): Promise<void> => {
 if (isProcessingGuildQueue) return;
 if (cache.requestingGuild) return;
 if (cache.requestGuildQueue.size === 0) return;

 isProcessingGuildQueue = true;
 try {
  const [nextGuild] = [...cache.requestGuildQueue.values()]
   .map((id) => ({ id, members: cache.members.get(id) || 0 }))
   .sort((a, b) => b.members - a.members);

  if (!nextGuild) return;

  cache.requestGuildQueue.delete(nextGuild.id);
  await requestGuildMembers(nextGuild.id);
 } finally {
  isProcessingGuildQueue = false;
 }
};

setInterval(() => {
 processGuildQueue().catch(() => {});
}, 100);

export default requestGuildMembers;
