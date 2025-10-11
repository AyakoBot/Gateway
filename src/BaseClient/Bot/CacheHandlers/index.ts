import {
 GatewayDispatchEvents,
 type APIGuildChannel,
 type APIThreadChannel,
 type GatewayApplicationCommandPermissionsUpdateDispatchData,
 type GatewayDispatchPayload,
 type GatewayGuildSoundboardSoundsUpdateDispatchData,
 type GatewayInteractionCreateDispatchData,
 type GatewayPresenceUpdateDispatchData,
 type GatewayRateLimitedDispatchData,
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
import firstChannelInteraction from '../../../Util/firstChannelInteraction.js';
import firstGuildInteraction, { tasks } from '../../../Util/firstGuildInteraction.js';
import type { RChannelTypes } from '../CacheClasses/channel.js';
import ready from '../Events/ready.js';
import { cache as redis } from '../Redis.js';

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
 emit(data.t, data.d);
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

 [GatewayDispatchEvents.ApplicationCommandPermissionsUpdate]: (
  data: GatewayApplicationCommandPermissionsUpdateDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  data.permissions.forEach((perm) => redis.commandPermissions.set(perm, data.guild_id, data.id));
 },

 [GatewayDispatchEvents.SoundboardSounds]: (
  data: GatewayGuildSoundboardSoundsUpdateDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  data.soundboard_sounds.forEach((sound) =>
   redis.soundboards.set({ ...sound, guild_id: data.guild_id || sound.guild_id }),
  );
 },

 [GatewayDispatchEvents.InteractionCreate]: (data: GatewayInteractionCreateDispatchData) => {
  if (data.guild_id) firstGuildInteraction(data.guild_id);
  if (data.channel?.id && data.guild_id) firstChannelInteraction(data.channel.id, data.guild_id);
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

 [GatewayDispatchEvents.UserUpdate]: (data: GatewayUserUpdateDispatchData) => {
  redis.users.set(data);
 },

 [GatewayDispatchEvents.WebhooksUpdate]: (data: GatewayWebhooksUpdateDispatchData) => {
  tasks.webhooks(data.guild_id);
 },

 [GatewayDispatchEvents.TypingStart]: (data: GatewayTypingStartDispatchData) => {
  if (!data.member || !data.guild_id) return;
  firstGuildInteraction(data.guild_id);
  firstChannelInteraction(data.channel_id, data.guild_id);

  redis.members.set(data.member, data.guild_id);
 },

 [GatewayDispatchEvents.Ready]: (data: GatewayReadyDispatchData, shardId: number | undefined) => {
  ready(data, shardId || '?');
  redis.users.set(data.user);
 },

 [GatewayDispatchEvents.Resumed]: (_: GatewayResumedDispatch['d']) => {},

 [GatewayDispatchEvents.PresenceUpdate]: (_: GatewayPresenceUpdateDispatchData) => {},

 [GatewayDispatchEvents.RateLimited]: (
  data: GatewayRateLimitedDispatchData,
  shardId: number | undefined,
 ) => [
  // eslint-disable-next-line no-console
  console.log(
   `[Shard ${shardId || '?'} Rate limited] ${data.retry_after}ms - ${data.opcode}: ${data.meta}`,
  ),
 ],
};
