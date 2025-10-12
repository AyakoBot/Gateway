import {
 GatewayDispatchEvents,
 type APIVoiceState,
 type GatewayVoiceChannelEffectSendDispatchData,
 type GatewayVoiceServerUpdateDispatchData,
} from 'discord-api-types/v10';

import firstChannelInteraction from '../../../Util/firstChannelInteraction.js';
import firstGuildInteraction from '../../../Util/firstGuildInteraction.js';
import { cache as redis } from '../Redis.js';

export default {
 [GatewayDispatchEvents.VoiceChannelEffectSend]: async (
  data: GatewayVoiceChannelEffectSendDispatchData,
 ) => {
  await firstGuildInteraction(data.guild_id);
  await firstChannelInteraction(data.channel_id, data.guild_id);
 },

 [GatewayDispatchEvents.VoiceServerUpdate]: async (data: GatewayVoiceServerUpdateDispatchData) => {
  await firstGuildInteraction(data.guild_id);
 },

 [GatewayDispatchEvents.VoiceStateUpdate]: async (data: APIVoiceState) => {
  if (!data.guild_id) return;

  await firstGuildInteraction(data.guild_id);
  if (data.channel_id) await firstChannelInteraction(data.channel_id, data.guild_id);

  redis.voices.set(data);
 },
} as const;
