import {
 GatewayDispatchEvents,
 type GatewayIntegrationCreateDispatchData,
 type GatewayIntegrationDeleteDispatchData,
 type GatewayIntegrationUpdateDispatchData,
} from 'discord-api-types/gateway/v10';

import firstGuildInteraction from '../../../Util/firstGuildInteraction.js';
import redis from '../Cache.js';

export default {
 [GatewayDispatchEvents.IntegrationCreate]: async (
  data: GatewayIntegrationCreateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.integrations.set(data, data.guild_id));
  return p;
 },

 [GatewayDispatchEvents.IntegrationDelete]: async (
  data: GatewayIntegrationDeleteDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.integrations.del(data.id));
  return p;
 },

 [GatewayDispatchEvents.IntegrationUpdate]: async (
  data: GatewayIntegrationUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.integrations.set(data, data.guild_id));
  return p;
 },
} as const;
