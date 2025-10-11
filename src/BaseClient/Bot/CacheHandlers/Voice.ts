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
 [GatewayDispatchEvents.VoiceChannelEffectSend]: (
  data: GatewayVoiceChannelEffectSendDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  firstChannelInteraction(data.channel_id, data.guild_id);
 },

 [GatewayDispatchEvents.VoiceServerUpdate]: (data: GatewayVoiceServerUpdateDispatchData) => {
  firstGuildInteraction(data.guild_id);
 },

 [GatewayDispatchEvents.VoiceStateUpdate]: (data: APIVoiceState) => {
  if (!data.guild_id) return;

  firstGuildInteraction(data.guild_id);
  if (data.channel_id) firstChannelInteraction(data.channel_id, data.guild_id);

  redis.voices.set(data);
 },
} as const;
