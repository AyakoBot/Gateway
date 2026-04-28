import type { RChannelTypes } from '@ayako/utility';
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
import firstGuildInteraction from '../../../Util/firstGuildInteraction.js';
import { priorityQueue } from '../../../Util/PriorityQueue/index.js';
import redis from '../Cache.js';
import { cache } from '../Client.js';
import ready from '../Events/ready.js';

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

export default (data: GatewayDispatchPayload, shardId: number) => {
 const handler = caches[data.t];
 if (!handler) {
  try {
   emit.call(redis, data.t, data.d);
   return;
  } catch (err) {
   // eslint-disable-next-line no-console
   console.error(`[CacheHandler] Error emitting ${data.t}:`, err);
   emit.call(redis, `raw:${data.t}` as never, data.d);
  }
  return;
 }

 try {
  const res = handler(data.d as Parameters<typeof handler>[0], shardId, []);

  if (res instanceof Promise) {
   res.then((r) => Promise.all(r).then(() => emit.call(redis, data.t, data.d)));
  } else {
   Promise.all(res).then(() => emit.call(redis, data.t, data.d));
  }
 } catch (err) {
  // eslint-disable-next-line no-console
  console.error(`[CacheHandler] Error processing ${data.t}:`, err);
  emit.call(redis, `raw:${data.t}` as never, data.d);
 }
};

const caches: Record<
 GatewayDispatchEvents,
 (
  data: never,
  additionalData: number | undefined,
  promiseArray: Promise<unknown>[],
 ) => Promise<unknown>[] | Promise<Promise<unknown>[]>
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
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (data.guild_id) p.push(firstGuildInteraction(data.guild_id));

  p.push(
   ...data.permissions.map((perm) => redis.commandPermissions.set(perm, data.guild_id, data.id)),
  );

  return p;
 },

 [GatewayDispatchEvents.SoundboardSounds]: async (
  data: GatewayGuildSoundboardSoundsUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  p.push(
   ...data.soundboard_sounds.map((sound) =>
    redis.soundboards.set({ ...sound, guild_id: data.guild_id || sound.guild_id }),
   ),
  );
  return p;
 },

 [GatewayDispatchEvents.InteractionCreate]: async (
  data: GatewayInteractionCreateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  const guildId = data.guild?.id || data.guild_id;

  if (guildId) p.push(firstGuildInteraction(guildId));
  if (data.user) p.push(redis.users.set(data.user));
  if (data.member && guildId) {
   p.push(redis.members.set(data.member, guildId));
   p.push(redis.users.set(data.member.user));
  }

  if (data.message && guildId) {
   p.push(redis.messages.set(data.message, guildId));
  }

  if (!data.channel || !guildId) return p;

  if (AllThreadGuildChannelTypes.includes(data.channel.type)) {
   p.push(
    redis.threads.set({
     ...(data.channel as APIThreadChannel),
     guild_id: (data.channel as APIThreadChannel).guild_id || guildId,
    }),
   );
   return p;
  }

  if (!AllNonThreadGuildChannelTypes.includes(data.channel.type)) return p;

  p.push(
   redis.channels.set({
    ...(data.channel as APIGuildChannel<RChannelTypes>),
    guild_id: guildId || (data.channel as APIGuildChannel<RChannelTypes>).guild_id,
   }),
  );

  return p;
 },

 [GatewayDispatchEvents.UserUpdate]: (
  data: GatewayUserUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(redis.users.set(data));

  return p;
 },

 [GatewayDispatchEvents.WebhooksUpdate]: (
  data: GatewayWebhooksUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  const memberCount = cache.members.get(data.guild_id) || 0;
  priorityQueue.enqueueGuildTask(data.guild_id, memberCount, 'webhooks');

  return p;
 },

 [GatewayDispatchEvents.TypingStart]: async (
  data: GatewayTypingStartDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (!data.member || !data.guild_id) return p;
  p.push(firstGuildInteraction(data.guild_id));

  p.push(redis.members.set(data.member, data.guild_id));
  return p;
 },

 [GatewayDispatchEvents.Ready]: (
  data: GatewayReadyDispatchData,
  shardId: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(ready(data, shardId ?? '?'));
  p.push(redis.users.set(data.user));

  return p;
 },

 [GatewayDispatchEvents.Resumed]: (
  _0: GatewayResumedDispatch['d'],
  _1: number | undefined,
  p: Promise<unknown>[] = [],
 ) => p,

 [GatewayDispatchEvents.PresenceUpdate]: (
  _0: GatewayPresenceUpdateDispatchData,
  _1: number | undefined,
  p: Promise<unknown>[] = [],
 ) => p,

 [GatewayDispatchEvents.RateLimited]: (
  data: GatewayRateLimitedDispatchData,
  shardId: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  // eslint-disable-next-line no-console
  console.log(
   `[Shard ${shardId || '?'} Rate limited] ${data.retry_after}ms - ${data.opcode}: ${data.meta}`,
  );

  return p;
 },
};
