import {
 GatewayDispatchEvents,
 type GatewayStageInstanceCreateDispatchData,
 type GatewayStageInstanceDeleteDispatchData,
 type GatewayStageInstanceUpdateDispatchData,
} from 'discord-api-types/v10';

import emit from '../../../Util/EventBus.js';
import { cache as redis } from '../Redis.js';

export default {
 [GatewayDispatchEvents.StageInstanceCreate]: (data: GatewayStageInstanceCreateDispatchData) => {
  redis.stages.set(data);

  emit(GatewayDispatchEvents.StageInstanceCreate, redis.stages.apiToR(data)!);
 },

 [GatewayDispatchEvents.StageInstanceDelete]: async (
  data: GatewayStageInstanceDeleteDispatchData,
 ) => {
  emit(GatewayDispatchEvents.StageInstanceCreate, (await redis.stages.get(data.id)) || data);

  redis.stages.del(data.id);
 },

 [GatewayDispatchEvents.StageInstanceUpdate]: async (
  data: GatewayStageInstanceUpdateDispatchData,
 ) => {
  emit(GatewayDispatchEvents.StageInstanceUpdate, {
   before: (await redis.stages.get(data.id)) || data,
   after: redis.stages.apiToR(data)!,
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
  });

  redis.stages.set(data);
 },
} as const;
