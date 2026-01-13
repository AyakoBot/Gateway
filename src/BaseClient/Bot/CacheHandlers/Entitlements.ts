import {
 GatewayDispatchEvents,
 type GatewayEntitlementCreateDispatchData,
 type GatewayEntitlementDeleteDispatchData,
 type GatewayEntitlementUpdateDispatchData,
} from 'discord-api-types/gateway/v10';

import firstGuildInteraction from '../../../Util/firstGuildInteraction.js';

export default {
 [GatewayDispatchEvents.EntitlementCreate]: (data: GatewayEntitlementCreateDispatchData) => {
  if (!data.guild_id) return;
  firstGuildInteraction(data.guild_id);
 },

 [GatewayDispatchEvents.EntitlementDelete]: (data: GatewayEntitlementDeleteDispatchData) => {
  if (!data.guild_id) return;
  firstGuildInteraction(data.guild_id);
 },

 [GatewayDispatchEvents.EntitlementUpdate]: (data: GatewayEntitlementUpdateDispatchData) => {
  if (!data.guild_id) return;
  firstGuildInteraction(data.guild_id);
 },
} as const;
