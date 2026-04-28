import {
 GatewayDispatchEvents,
 type APIVoiceState,
 type GatewayVoiceChannelEffectSendDispatchData,
 type GatewayVoiceServerUpdateDispatchData,
} from 'discord-api-types/v10';

import firstGuildInteraction from '../../../Util/firstGuildInteraction.js';
import redis from '../Cache.js';

export default {
 [GatewayDispatchEvents.VoiceChannelEffectSend]: async (
  data: GatewayVoiceChannelEffectSendDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  return p;
 },

 [GatewayDispatchEvents.VoiceServerUpdate]: async (
  data: GatewayVoiceServerUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  return p;
 },

 [GatewayDispatchEvents.VoiceStateUpdate]: async (
  data: APIVoiceState,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (!data.guild_id) return p;

  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.voices.set(data));
  return p;
 },
} as const;
