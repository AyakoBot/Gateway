import {
 GatewayDispatchEvents,
 type GatewaySubscriptionCreateDispatchData,
 type GatewaySubscriptionDeleteDispatchData,
 type GatewaySubscriptionUpdateDispatchData,
} from 'discord-api-types/gateway/v10';

export default {
 [GatewayDispatchEvents.SubscriptionCreate]: (
  _0: GatewaySubscriptionCreateDispatchData,
  _1: number | undefined,
  p: Promise<unknown>[] = [],
 ) => p,

 [GatewayDispatchEvents.SubscriptionDelete]: (
  _0: GatewaySubscriptionDeleteDispatchData,
  _1: number | undefined,
  p: Promise<unknown>[] = [],
 ) => p,

 [GatewayDispatchEvents.SubscriptionUpdate]: (
  _0: GatewaySubscriptionUpdateDispatchData,
  _1: number | undefined,
  p: Promise<unknown>[] = [],
 ) => p,
} as const;
