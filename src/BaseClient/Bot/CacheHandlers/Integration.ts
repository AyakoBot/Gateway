import {
 GatewayDispatchEvents,
 type GatewayIntegrationCreateDispatchData,
 type GatewayIntegrationDeleteDispatchData,
 type GatewayIntegrationUpdateDispatchData,
} from 'discord-api-types/v10';

import firstGuildInteraction from '../../../Util/firstGuildInteraction.js';
import redis from '../Redis.js';

export default {
 [GatewayDispatchEvents.IntegrationCreate]: async (data: GatewayIntegrationCreateDispatchData) => {
  firstGuildInteraction(data.guild_id);
  redis.integrations.set(data, data.guild_id);
 },

 [GatewayDispatchEvents.IntegrationDelete]: async (data: GatewayIntegrationDeleteDispatchData) => {
  firstGuildInteraction(data.guild_id);
  redis.integrations.del(data.id);
 },

 [GatewayDispatchEvents.IntegrationUpdate]: async (data: GatewayIntegrationUpdateDispatchData) => {
  firstGuildInteraction(data.guild_id);
  redis.integrations.set(data, data.guild_id);
 },
} as const;
