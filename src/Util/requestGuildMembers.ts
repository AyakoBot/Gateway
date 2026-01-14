/* eslint-disable no-console */
import { GatewayOpcodes } from 'discord-api-types/gateway/v10';

import RedisCache from '../BaseClient/Bot/Cache.js';
import { cache, gateway } from '../BaseClient/Bot/Client.js';

import calculateShardId from './calculateShardId.js';

const requestGuildMembers = async (guildId: string) => {
 if (cache.requestingGuild !== guildId && cache.requestingGuild) {
  cache.requestGuildQueue.add(guildId);
  return Promise.resolve();
 }

 const [isMember] = await RedisCache.execPipeline<[string | null]>((pipeline) => {
  pipeline.hget('guild-members-requested', guildId);
  pipeline.hset('guild-members-requested', guildId, '1');
  pipeline.call('hexpire', 'guild-members-requested', 604800, 'NX', 'FIELDS', 1, guildId);
 });
 if (isMember === '1') return Promise.resolve();

 cache.requestingGuild = guildId;

 console.log('[Chunk] Requesting guild members for', guildId);

 gateway.send(calculateShardId(guildId), {
  op: GatewayOpcodes.RequestGuildMembers,
  d: { guild_id: guildId, presences: false, limit: 0, query: '' },
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
 console.log('[Chunk] Left in queue:', cache.requestGuildQueue.size);
 requestGuildMembers(nextGuild.id);
}, 100);

export default requestGuildMembers;
