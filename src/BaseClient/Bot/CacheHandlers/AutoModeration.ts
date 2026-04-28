import {
 GatewayDispatchEvents,
 type GatewayAutoModerationActionExecutionDispatchData,
 type GatewayAutoModerationRuleCreateDispatchData,
 type GatewayAutoModerationRuleDeleteDispatchData,
 type GatewayAutoModerationRuleUpdateDispatchData,
} from 'discord-api-types/gateway/v10';

import firstGuildInteraction from '../../../Util/firstGuildInteraction.js';
import redis from '../Cache.js';

export default {
 [GatewayDispatchEvents.AutoModerationActionExecution]: async (
  data: GatewayAutoModerationActionExecutionDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  return p;
 },

 [GatewayDispatchEvents.AutoModerationRuleCreate]: async (
  data: GatewayAutoModerationRuleCreateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.automods.set(data));
  return p;
 },

 [GatewayDispatchEvents.AutoModerationRuleDelete]: async (
  data: GatewayAutoModerationRuleDeleteDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.automods.del(data.id));
  return p;
 },

 [GatewayDispatchEvents.AutoModerationRuleUpdate]: async (
  data: GatewayAutoModerationRuleUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.automods.set(data));
  return p;
 },
} as const;
