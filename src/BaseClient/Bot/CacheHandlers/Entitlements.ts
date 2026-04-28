import {
 GatewayDispatchEvents,
 type GatewayEntitlementCreateDispatchData,
 type GatewayEntitlementDeleteDispatchData,
 type GatewayEntitlementUpdateDispatchData,
} from 'discord-api-types/gateway/v10';

import firstGuildInteraction from '../../../Util/firstGuildInteraction.js';

export default {
 [GatewayDispatchEvents.EntitlementCreate]: (
  data: GatewayEntitlementCreateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (!data.guild_id) return p;
  p.push(firstGuildInteraction(data.guild_id));
  return p;
 },

 [GatewayDispatchEvents.EntitlementDelete]: (
  data: GatewayEntitlementDeleteDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (!data.guild_id) return p;
  p.push(firstGuildInteraction(data.guild_id));
  return p;
 },

 [GatewayDispatchEvents.EntitlementUpdate]: (
  data: GatewayEntitlementUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (!data.guild_id) return p;
  p.push(firstGuildInteraction(data.guild_id));
  return p;
 },
} as const;
