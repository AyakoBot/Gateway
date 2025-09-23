import {
 GatewayDispatchEvents,
 type GatewaySubscriptionCreateDispatchData,
 type GatewaySubscriptionDeleteDispatchData,
 type GatewaySubscriptionUpdateDispatchData,
} from 'discord-api-types/v10';

export default {
 [GatewayDispatchEvents.SubscriptionCreate]: (_: GatewaySubscriptionCreateDispatchData) => {},

 [GatewayDispatchEvents.SubscriptionDelete]: (_: GatewaySubscriptionDeleteDispatchData) => {},

 [GatewayDispatchEvents.SubscriptionUpdate]: (_: GatewaySubscriptionUpdateDispatchData) => {},
} as const;
