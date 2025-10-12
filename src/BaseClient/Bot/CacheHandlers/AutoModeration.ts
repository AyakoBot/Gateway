import {
 GatewayDispatchEvents,
 type GatewayAutoModerationActionExecutionDispatchData,
 type GatewayAutoModerationRuleCreateDispatchData,
 type GatewayAutoModerationRuleDeleteDispatchData,
 type GatewayAutoModerationRuleUpdateDispatchData,
} from 'discord-api-types/v10';

import firstChannelInteraction from '../../../Util/firstChannelInteraction.js';
import firstGuildInteraction from '../../../Util/firstGuildInteraction.js';
import { cache as redis } from '../Redis.js';

export default {
 [GatewayDispatchEvents.AutoModerationActionExecution]: async (
  data: GatewayAutoModerationActionExecutionDispatchData,
 ) => {
  await firstGuildInteraction(data.guild_id);
  if (data.channel_id) await firstChannelInteraction(data.channel_id, data.guild_id);
 },

 [GatewayDispatchEvents.AutoModerationRuleCreate]: async (
  data: GatewayAutoModerationRuleCreateDispatchData,
 ) => {
  await firstGuildInteraction(data.guild_id);
  redis.automods.set(data);
 },

 [GatewayDispatchEvents.AutoModerationRuleDelete]: async (
  data: GatewayAutoModerationRuleDeleteDispatchData,
 ) => {
  await firstGuildInteraction(data.guild_id);
  redis.automods.del(data.id);
 },

 [GatewayDispatchEvents.AutoModerationRuleUpdate]: async (
  data: GatewayAutoModerationRuleUpdateDispatchData,
 ) => {
  await firstGuildInteraction(data.guild_id);
  redis.automods.set(data);
 },
} as const;
