import {
 GatewayDispatchEvents,
 type APIVoiceState,
 type GatewayVoiceChannelEffectSendDispatchData,
 type GatewayVoiceServerUpdateDispatchData,
} from 'discord-api-types/v10';

import { cache as redis } from '../Redis.js';

export default {
 [GatewayDispatchEvents.VoiceChannelEffectSend]: (
  _: GatewayVoiceChannelEffectSendDispatchData,
 ) => {},

 [GatewayDispatchEvents.VoiceServerUpdate]: (_: GatewayVoiceServerUpdateDispatchData) => {},

 [GatewayDispatchEvents.VoiceStateUpdate]: (data: APIVoiceState) => {
  if (!data.guild_id) return;

  redis.voices.set(data);
 },
} as const;
