import { GatewayOpcodes } from 'discord-api-types/v10';

import { cache, gateway } from '../BaseClient/Bot/Client.js';

import calculateShardId from './calculateShardId.js';

const requestGuildMembers = (guildId: string) => {
 if (cache.requestingGuild !== guildId && cache.requestingGuild) {
  cache.requestGuildQueue.add(guildId);
  return Promise.resolve();
 }

 if (cache.requestedGuilds.has(guildId)) return Promise.resolve();
 cache.requestedGuilds.add(guildId);

 cache.requestingGuild = guildId;

 // eslint-disable-next-line no-console
 console.log('[CHUNK] Requesting guild members for', guildId);

 return gateway.send(calculateShardId(guildId), {
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
