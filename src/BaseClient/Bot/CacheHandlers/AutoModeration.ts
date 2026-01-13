import {
 GatewayDispatchEvents,
 type GatewayAutoModerationActionExecutionDispatchData,
 type GatewayAutoModerationRuleCreateDispatchData,
 type GatewayAutoModerationRuleDeleteDispatchData,
 type GatewayAutoModerationRuleUpdateDispatchData,
} from 'discord-api-types/gateway/v10';

import firstChannelInteraction from '../../../Util/firstChannelInteraction.js';
import firstGuildInteraction from '../../../Util/firstGuildInteraction.js';
import redis from '../Cache.js';

export default {
 [GatewayDispatchEvents.AutoModerationActionExecution]: async (
  data: GatewayAutoModerationActionExecutionDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  if (data.channel_id) firstChannelInteraction(data.channel_id, data.guild_id);
 },

 [GatewayDispatchEvents.AutoModerationRuleCreate]: async (
  data: GatewayAutoModerationRuleCreateDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  redis.automods.set(data);
 },

 [GatewayDispatchEvents.AutoModerationRuleDelete]: async (
  data: GatewayAutoModerationRuleDeleteDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  redis.automods.del(data.id);
 },

 [GatewayDispatchEvents.AutoModerationRuleUpdate]: async (
  data: GatewayAutoModerationRuleUpdateDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  redis.automods.set(data);
 },
} as const;
