import {
 GatewayDispatchEvents,
 type GatewayEntitlementCreateDispatchData,
 type GatewayEntitlementDeleteDispatchData,
 type GatewayEntitlementUpdateDispatchData,
} from 'discord-api-types/v10';

export default {
 [GatewayDispatchEvents.EntitlementCreate]: (_: GatewayEntitlementCreateDispatchData) => {},

 [GatewayDispatchEvents.EntitlementDelete]: (_: GatewayEntitlementDeleteDispatchData) => {},

 [GatewayDispatchEvents.EntitlementUpdate]: (_: GatewayEntitlementUpdateDispatchData) => {},
} as const;
