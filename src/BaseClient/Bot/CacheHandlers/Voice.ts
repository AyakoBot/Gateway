import {
 GatewayDispatchEvents,
 type APIVoiceState,
 type GatewayVoiceChannelEffectSendDispatchData,
 type GatewayVoiceServerUpdateDispatchData,
} from 'discord-api-types/v10';

import emit from '../../../Util/EventBus.js';
import type { RVoiceState } from '../CacheClasses/voice.js';
import { cache as redis } from '../Redis.js';

export default {
 [GatewayDispatchEvents.VoiceChannelEffectSend]: async (
  data: GatewayVoiceChannelEffectSendDispatchData,
 ) => {
  emit(GatewayDispatchEvents.VoiceChannelEffectSend, {
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
   channel: (await redis.channels.get(data.channel_id)) || { id: data.channel_id },
   user: (await redis.users.get(data.user_id)) || { id: data.user_id },
   animation_id: data.animation_id,
   animation_type: data.animation_type,
   emoji:
    data.emoji && data.emoji.require_colons
     ? `${data.emoji.animated ? 'a' : ''}:${data.emoji.name}:${data.emoji.id}`
     : data.emoji?.name || null,
   sound_id: data.sound_id,
   sound_volume: data.sound_volume,
  });
 },

 [GatewayDispatchEvents.VoiceServerUpdate]: async (data: GatewayVoiceServerUpdateDispatchData) => {
  emit(GatewayDispatchEvents.VoiceServerUpdate, {
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
   token: data.token,
   endpoint: data.endpoint,
  });
 },

 [GatewayDispatchEvents.VoiceStateUpdate]: async (data: APIVoiceState) => {
  if (!data.guild_id) return;

  emit(GatewayDispatchEvents.VoiceStateUpdate, {
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
   channel: (await redis.channels.get(data.channel_id || '')) || null,
   before: (await redis.voices.get(data.user_id)) || null,
   after: redis.voices.apiToR(data) as RVoiceState,
   user: (await redis.users.get(data.user_id)) || { id: data.user_id },
  });

  redis.voices.set(data);
 },
} as const;
