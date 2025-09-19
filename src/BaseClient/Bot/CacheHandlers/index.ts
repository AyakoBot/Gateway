import {
 GatewayDispatchEvents,
 type APIGuildChannel,
 type APIThreadChannel,
 type GatewayApplicationCommandPermissionsUpdateDispatchData,
 type GatewayDispatchPayload,
 type GatewayGuildSoundboardSoundsUpdateDispatchData,
 type GatewayInteractionCreateDispatchData,
 type GatewayPresenceUpdateDispatchData,
 type GatewayReadyDispatchData,
 type GatewayResumedDispatch,
 type GatewayTypingStartDispatchData,
 type GatewayUserUpdateDispatchData,
 type GatewayWebhooksUpdateDispatchData,
} from '@discordjs/core';

import {
 AllNonThreadGuildChannelTypes,
 AllThreadGuildChannelTypes,
} from '../../../Typings/Channel.js';
import emit from '../../../Util/EventBus.js';
import type { RChannelTypes } from '../CacheClasses/channel.js';
import type { RCommandPermission } from '../CacheClasses/commandPermission.js';
import ready from '../Events/ready.js';
import RedisClient, { cache as redis } from '../Redis.js';

import AutoModeration from './AutoModeration.js';
import Channel from './Channel.js';
import Entitlements from './Entitlements.js';
import Guilds from './Guilds.js';
import Integration from './Integration.js';
import Invite from './Invite.js';
import Message from './Message.js';
import Stage from './Stage.js';
import Subscription from './Subscription.js';
import Thread from './Thread.js';
import Voice from './Voice.js';

export default async (data: GatewayDispatchPayload, shardId: number) => {
 const cache = caches[data.t];
 if (!cache) return;

 cache(data.d as Parameters<typeof cache>[0], shardId);
};

const caches: Record<
 GatewayDispatchEvents,
 (data: never, additionalData: number | undefined) => unknown
> = {
 ...AutoModeration,
 ...Channel,
 ...Entitlements,
 ...Guilds,
 ...Integration,
 ...Invite,
 ...Message,
 ...Stage,
 ...Thread,
 ...Voice,
 ...Subscription,

 [GatewayDispatchEvents.ApplicationCommandPermissionsUpdate]: async (
  data: GatewayApplicationCommandPermissionsUpdateDispatchData,
 ) => {
  const existing = await RedisClient.hgetall(redis.commandPermissions.keystore(data.guild_id));
  data.permissions.forEach((perm) => redis.commandPermissions.set(perm, data.guild_id, data.id));

  emit(GatewayDispatchEvents.ApplicationCommandPermissionsUpdate, {
   before: (Object.values(existing) || []).map((e) => JSON.parse(e) as RCommandPermission),
   after: data.permissions.map((p) => redis.commandPermissions.apiToR(p, data.guild_id, data.id)!),
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
  });
 },

 [GatewayDispatchEvents.SoundboardSounds]: async (
  data: GatewayGuildSoundboardSoundsUpdateDispatchData,
 ) => {
  data.soundboard_sounds.forEach((sound) =>
   redis.soundboards.set({ ...sound, guild_id: data.guild_id || sound.guild_id }),
  );

  emit(GatewayDispatchEvents.SoundboardSounds, {
   sounds: data.soundboard_sounds.map((s) => redis.soundboards.apiToR(s)!),
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
  });
 },

 [GatewayDispatchEvents.InteractionCreate]: (data: GatewayInteractionCreateDispatchData) => {
  emit(GatewayDispatchEvents.InteractionCreate, data);

  if (data.user) redis.users.set(data.user);

  if (data.message && data.guild_id) {
   redis.messages.set(data.message, (data.guild_id || data.guild?.id)!);
  }

  if (!data.channel || !data.guild_id) return;

  if (AllThreadGuildChannelTypes.includes(data.channel.type)) {
   redis.threads.set({
    ...(data.channel as APIThreadChannel),
    guild_id: (data.channel as APIThreadChannel).guild_id || data.guild_id,
   });
   return;
  }

  if (!AllNonThreadGuildChannelTypes.includes(data.channel.type)) return;

  redis.channels.set({
   ...(data.channel as APIGuildChannel<RChannelTypes>),
   guild_id: data.guild_id || (data.channel as APIGuildChannel<RChannelTypes>).guild_id,
  });
 },

 [GatewayDispatchEvents.UserUpdate]: async (data: GatewayUserUpdateDispatchData) => {
  emit(GatewayDispatchEvents.UserUpdate, {
   before: await redis.users.get(data.id),
   after: redis.users.apiToR(data)!,
  });
  redis.users.set(data);
 },

 [GatewayDispatchEvents.WebhooksUpdate]: async (data: GatewayWebhooksUpdateDispatchData) => {
  emit(GatewayDispatchEvents.WebhooksUpdate, {
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
   channel: (await redis.channels.get(data.channel_id)) || { id: data.channel_id },
  });
 },

 [GatewayDispatchEvents.TypingStart]: async (data: GatewayTypingStartDispatchData) => {
  emit(GatewayDispatchEvents.TypingStart, {
   channel: (await redis.channels.get(data.channel_id)) || { id: data.channel_id },
   guild: data.guild_id ? (await redis.guilds.get(data.guild_id)) || { id: data.guild_id } : null,
   user: (await redis.users.get(data.user_id)) || { id: data.user_id },
   timestamp: data.timestamp,
   member: data.member && data.guild_id ? redis.members.apiToR(data.member, data.guild_id) : null,
  });

  if (!data.member || !data.guild_id) return;

  redis.members.set(data.member, data.guild_id);
 },

 [GatewayDispatchEvents.Ready]: (data: GatewayReadyDispatchData, shardId: number | undefined) => {
  ready(data, shardId || '?');
  redis.users.set(data.user);

  emit(GatewayDispatchEvents.Ready, {
   user: redis.users.apiToR(data.user)!,
   version: data.v,
   guilds: data.guilds,
   session: data.session_id,
   shard: data.shard,
   application: data.application,
  });
 },

 [GatewayDispatchEvents.Resumed]: (data: GatewayResumedDispatch['d']) => {
  emit(GatewayDispatchEvents.Resumed, data);
 },

 [GatewayDispatchEvents.PresenceUpdate]: async (data: GatewayPresenceUpdateDispatchData) => {
  emit(GatewayDispatchEvents.PresenceUpdate, {
   user: (await redis.users.get(data.user.id))!,
   status: data.status,
   activities: data.activities,
   client_status: data.client_status,
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
  });
 },
};
