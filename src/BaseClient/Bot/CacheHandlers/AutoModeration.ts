import {
 GatewayDispatchEvents,
 type GatewayAutoModerationActionExecutionDispatchData,
 type GatewayAutoModerationRuleCreateDispatchData,
 type GatewayAutoModerationRuleDeleteDispatchData,
 type GatewayAutoModerationRuleUpdateDispatchData,
} from 'discord-api-types/v10';

import emit from '../../../Util/EventBus.js';
import { cache as redis } from '../Redis.js';

export default {
 [GatewayDispatchEvents.AutoModerationActionExecution]: (
  data: GatewayAutoModerationActionExecutionDispatchData,
 ) => {
  emit(GatewayDispatchEvents.AutoModerationActionExecution, data);
 },

 [GatewayDispatchEvents.AutoModerationRuleCreate]: (
  data: GatewayAutoModerationRuleCreateDispatchData,
 ) => {
  redis.automods.set(data);
  emit(GatewayDispatchEvents.AutoModerationRuleCreate, data);
 },

 [GatewayDispatchEvents.AutoModerationRuleDelete]: (
  data: GatewayAutoModerationRuleDeleteDispatchData,
 ) => {
  redis.automods.del(data.id);
  emit(GatewayDispatchEvents.AutoModerationRuleDelete, data);
 },

 [GatewayDispatchEvents.AutoModerationRuleUpdate]: async (
  data: GatewayAutoModerationRuleUpdateDispatchData,
 ) => {
  emit(GatewayDispatchEvents.AutoModerationRuleUpdate, {
   after: data,
   before: await redis.automods.get(data.id),
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
  });

  redis.automods.set(data);
 },
} as const;
