import {
 GatewayDispatchEvents,
 type GatewayStageInstanceCreateDispatchData,
 type GatewayStageInstanceDeleteDispatchData,
 type GatewayStageInstanceUpdateDispatchData,
} from 'discord-api-types/v10';

import firstChannelInteraction from '../../../Util/firstChannelInteraction.js';
import firstGuildInteraction from '../../../Util/firstGuildInteraction.js';
import { cache as redis } from '../Redis.js';

export default {
 [GatewayDispatchEvents.StageInstanceCreate]: async (
  data: GatewayStageInstanceCreateDispatchData,
 ) => {
  await firstGuildInteraction(data.guild_id);
  await firstChannelInteraction(data.channel_id, data.guild_id);

  redis.stages.set(data);
 },

 [GatewayDispatchEvents.StageInstanceDelete]: async (
  data: GatewayStageInstanceDeleteDispatchData,
 ) => {
  await firstGuildInteraction(data.guild_id);
  await firstChannelInteraction(data.channel_id, data.guild_id);

  redis.stages.del(data.id);
 },

 [GatewayDispatchEvents.StageInstanceUpdate]: async (
  data: GatewayStageInstanceUpdateDispatchData,
 ) => {
  await firstGuildInteraction(data.guild_id);
  await firstChannelInteraction(data.channel_id, data.guild_id);

  redis.stages.set(data);
 },
} as const;
