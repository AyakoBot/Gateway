import {
 GatewayDispatchEvents,
 type GatewayEntitlementCreateDispatchData,
 type GatewayEntitlementDeleteDispatchData,
 type GatewayEntitlementUpdateDispatchData,
} from 'discord-api-types/v10';

import emit from '../../../Util/EventBus.js';

export default {
 [GatewayDispatchEvents.EntitlementCreate]: (data: GatewayEntitlementCreateDispatchData) => {
  emit(GatewayDispatchEvents.EntitlementCreate, data);
 },

 [GatewayDispatchEvents.EntitlementDelete]: (data: GatewayEntitlementDeleteDispatchData) => {
  emit(GatewayDispatchEvents.EntitlementDelete, data);
 },

 [GatewayDispatchEvents.EntitlementUpdate]: (data: GatewayEntitlementUpdateDispatchData) => {
  emit(GatewayDispatchEvents.EntitlementUpdate, data);
 },
} as const;
