import { GatewayOpcodes } from 'discord-api-types/v10';

import { gateway } from '../BaseClient/Bot/Client.js';

import calculateShardId from './calculateShardId.js';

export default (guildId: string) =>
 gateway.send(calculateShardId(guildId), {
  op: GatewayOpcodes.RequestGuildMembers,
  d: {
   guild_id: guildId,
   presences: false,
   limit: 0,
   query: '',
  },
 });
