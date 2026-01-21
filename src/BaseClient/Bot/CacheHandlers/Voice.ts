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
 ) => {
  firstGuildInteraction(data.guild_id);
 },

 [GatewayDispatchEvents.VoiceServerUpdate]: async (data: GatewayVoiceServerUpdateDispatchData) => {
  firstGuildInteraction(data.guild_id);
 },

 [GatewayDispatchEvents.VoiceStateUpdate]: async (data: APIVoiceState) => {
  if (!data.guild_id) return;

  firstGuildInteraction(data.guild_id);

  redis.voices.set(data);
 },
} as const;
