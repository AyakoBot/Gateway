import {
 GatewayDispatchEvents,
 type GatewayIntegrationCreateDispatchData,
 type GatewayIntegrationDeleteDispatchData,
 type GatewayIntegrationUpdateDispatchData,
} from 'discord-api-types/v10';

import emit from '../../../Util/EventBus.js';
import { cache as redis } from '../Redis.js';

export default {
 [GatewayDispatchEvents.IntegrationCreate]: (data: GatewayIntegrationCreateDispatchData) => {
  redis.integrations.set(data, data.guild_id);

  emit(GatewayDispatchEvents.IntegrationCreate, redis.integrations.apiToR(data, data.guild_id)!);
 },

 [GatewayDispatchEvents.IntegrationDelete]: async (data: GatewayIntegrationDeleteDispatchData) => {
  emit(GatewayDispatchEvents.IntegrationDelete, (await redis.integrations.get(data.id)) || data);
  redis.integrations.del(data.id);
 },

 [GatewayDispatchEvents.IntegrationUpdate]: async (data: GatewayIntegrationUpdateDispatchData) => {
  const existing = await redis.integrations.get(data.id);
  redis.integrations.set(data, data.guild_id);

  emit(GatewayDispatchEvents.IntegrationUpdate, {
   before: existing,
   after: redis.integrations.apiToR(data, data.guild_id)!,
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
  });
 },
} as const;
