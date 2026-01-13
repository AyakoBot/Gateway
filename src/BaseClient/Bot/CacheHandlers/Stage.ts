import {
 GatewayDispatchEvents,
 type GatewayStageInstanceCreateDispatchData,
 type GatewayStageInstanceDeleteDispatchData,
 type GatewayStageInstanceUpdateDispatchData,
} from 'discord-api-types/v10';

import firstChannelInteraction from '../../../Util/firstChannelInteraction.js';
import firstGuildInteraction from '../../../Util/firstGuildInteraction.js';
import redis from '../Redis.js';

export default {
 [GatewayDispatchEvents.StageInstanceCreate]: async (
  data: GatewayStageInstanceCreateDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  firstChannelInteraction(data.channel_id, data.guild_id);

  redis.stages.set(data);
 },

 [GatewayDispatchEvents.StageInstanceDelete]: async (
  data: GatewayStageInstanceDeleteDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  firstChannelInteraction(data.channel_id, data.guild_id);

  redis.stages.del(data.id);
 },

 [GatewayDispatchEvents.StageInstanceUpdate]: async (
  data: GatewayStageInstanceUpdateDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  firstChannelInteraction(data.channel_id, data.guild_id);

  redis.stages.set(data);
 },
} as const;
