import {
 GatewayDispatchEvents,
 type GatewaySubscriptionCreateDispatchData,
 type GatewaySubscriptionDeleteDispatchData,
 type GatewaySubscriptionUpdateDispatchData,
} from 'discord-api-types/v10';

import emit from '../../../Util/EventBus.js';

export default {
 [GatewayDispatchEvents.SubscriptionCreate]: (data: GatewaySubscriptionCreateDispatchData) => {
  emit(GatewayDispatchEvents.SubscriptionCreate, data);
 },

 [GatewayDispatchEvents.SubscriptionDelete]: (data: GatewaySubscriptionDeleteDispatchData) => {
  emit(GatewayDispatchEvents.SubscriptionCreate, data);
 },

 [GatewayDispatchEvents.SubscriptionUpdate]: (data: GatewaySubscriptionUpdateDispatchData) => {
  emit(GatewayDispatchEvents.SubscriptionCreate, data);
 },
} as const;
