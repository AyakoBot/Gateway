import {
 GatewayDispatchEvents,
 type GatewayAutoModerationActionExecutionDispatchData,
 type GatewayAutoModerationRuleCreateDispatchData,
 type GatewayAutoModerationRuleDeleteDispatchData,
 type GatewayAutoModerationRuleUpdateDispatchData,
} from 'discord-api-types/v10';

import { cache as redis } from '../Redis.js';

export default {
 [GatewayDispatchEvents.AutoModerationActionExecution]: (
  _: GatewayAutoModerationActionExecutionDispatchData,
 ) => {},

 [GatewayDispatchEvents.AutoModerationRuleCreate]: (
  data: GatewayAutoModerationRuleCreateDispatchData,
 ) => {
  redis.automods.set(data);
 },

 [GatewayDispatchEvents.AutoModerationRuleDelete]: (
  data: GatewayAutoModerationRuleDeleteDispatchData,
 ) => {
  redis.automods.del(data.id);
 },

 [GatewayDispatchEvents.AutoModerationRuleUpdate]: (
  data: GatewayAutoModerationRuleUpdateDispatchData,
 ) => {
  redis.automods.set(data);
 },
} as const;
