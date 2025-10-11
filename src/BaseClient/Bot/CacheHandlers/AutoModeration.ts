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
 [GatewayDispatchEvents.AutoModerationActionExecution]: (
  data: GatewayAutoModerationActionExecutionDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  if (data.channel_id) firstChannelInteraction(data.channel_id, data.guild_id);
 },

 [GatewayDispatchEvents.AutoModerationRuleCreate]: (
  data: GatewayAutoModerationRuleCreateDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  redis.automods.set(data);
 },

 [GatewayDispatchEvents.AutoModerationRuleDelete]: (
  data: GatewayAutoModerationRuleDeleteDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  redis.automods.del(data.id);
 },

 [GatewayDispatchEvents.AutoModerationRuleUpdate]: (
  data: GatewayAutoModerationRuleUpdateDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  redis.automods.set(data);
 },
} as const;
