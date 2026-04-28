import {
 GatewayDispatchEvents,
 type GatewayStageInstanceCreateDispatchData,
 type GatewayStageInstanceDeleteDispatchData,
 type GatewayStageInstanceUpdateDispatchData,
} from 'discord-api-types/gateway/v10';

import firstGuildInteraction from '../../../Util/firstGuildInteraction.js';

import redis from '../Cache.js';

export default {
 [GatewayDispatchEvents.StageInstanceCreate]: async (
  data: GatewayStageInstanceCreateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.stages.set(data));
  return p;
 },

 [GatewayDispatchEvents.StageInstanceDelete]: async (
  data: GatewayStageInstanceDeleteDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.stages.del(data.id));
  return p;
 },

 [GatewayDispatchEvents.StageInstanceUpdate]: async (
  data: GatewayStageInstanceUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.stages.set(data));
  return p;
 },
} as const;
