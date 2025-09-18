import {
 GatewayDispatchEvents,
 type GatewayMessageCreateDispatchData,
 type GatewayMessageDeleteBulkDispatchData,
 type GatewayMessageDeleteDispatchData,
 type GatewayMessagePollVoteDispatchData,
 type GatewayMessageReactionAddDispatchData,
 type GatewayMessageReactionRemoveAllDispatchData,
 type GatewayMessageReactionRemoveDispatchData,
 type GatewayMessageReactionRemoveEmojiDispatchData,
 type GatewayMessageUpdateDispatchData,
} from 'discord-api-types/v10';

import { AllThreadGuildChannelTypes } from '../../../Typings/Channel.js';
import emit from '../../../Util/EventBus.js';
import type { RReaction } from '../CacheClasses/reaction.js';
import RedisClient, { cache as redis } from '../Redis.js';

export default {
 [GatewayDispatchEvents.MessageCreate]: async (data: GatewayMessageCreateDispatchData) => {
  if (data.guild_id) redis.messages.set(data, data.guild_id || '@me');

  if (!data.webhook_id) redis.users.set(data.author);

  emit(GatewayDispatchEvents.MessageCreate, redis.messages.apiToR(data, data.guild_id || '@me')!);

  if (!AllThreadGuildChannelTypes.includes(data.type)) return;

  const cache = await redis.threads.get(data.channel_id);
  if (cache) redis.threads.set({ ...cache, message_count: (cache.message_count || 0) + 1 });
 },

 [GatewayDispatchEvents.MessageDelete]: async (data: GatewayMessageDeleteDispatchData) => {
  emit(GatewayDispatchEvents.MessageDelete, (await redis.messages.get(data.id)) || data);

  redis.messages.del(data.id);
 },

 [GatewayDispatchEvents.MessageDeleteBulk]: async (data: GatewayMessageDeleteBulkDispatchData) => {
  emit(GatewayDispatchEvents.MessageDeleteBulk, {
   messages: await Promise.all(
    data.ids.map(async (id) => (await redis.messages.get(id)) || { id }),
   ),
   channel: (await redis.channels.get(data.channel_id)) || { id: data.channel_id },
   guild: data.guild_id
    ? (await redis.guilds.get(data.guild_id)) || { id: data.guild_id }
    : undefined,
  });

  data.ids.forEach((id) => redis.messages.del(id));
 },

 [GatewayDispatchEvents.MessageUpdate]: async (data: GatewayMessageUpdateDispatchData) => {
  emit(GatewayDispatchEvents.MessageUpdate, {
   before: (await redis.messages.get(data.id)) || null,
   after: redis.messages.apiToR(data, data.guild_id || '@me')!,
   guild: data.guild_id
    ? (await redis.guilds.get(data.guild_id)) || { id: data.guild_id }
    : undefined,
  });

  if (data.guild_id) redis.messages.set(data, data.guild_id);
 },

 [GatewayDispatchEvents.MessagePollVoteAdd]: async (data: GatewayMessagePollVoteDispatchData) => {
  emit(GatewayDispatchEvents.MessagePollVoteAdd, {
   answer_id: data.answer_id,
   message: (await redis.messages.get(data.message_id)) || { id: data.message_id },
   user: (await redis.users.get(data.user_id)) || { id: data.user_id },
   channel: (await redis.channels.get(data.channel_id)) || { id: data.channel_id },
   guild: data.guild_id ? (await redis.guilds.get(data.guild_id)) || { id: data.guild_id } : null,
  });
 },

 [GatewayDispatchEvents.MessagePollVoteRemove]: async (
  data: GatewayMessagePollVoteDispatchData,
 ) => {
  emit(GatewayDispatchEvents.MessagePollVoteAdd, {
   answer_id: data.answer_id,
   message: (await redis.messages.get(data.message_id)) || { id: data.message_id },
   user: (await redis.users.get(data.user_id)) || { id: data.user_id },
   channel: (await redis.channels.get(data.channel_id)) || { id: data.channel_id },
   guild: data.guild_id ? (await redis.guilds.get(data.guild_id)) || { id: data.guild_id } : null,
  });
 },

 [GatewayDispatchEvents.MessageReactionAdd]: async (
  data: GatewayMessageReactionAddDispatchData,
 ) => {
  if (data.member && data.guild_id) redis.members.set(data.member, data.guild_id);

  if (data.member?.user) redis.users.set(data.member.user);

  emit(GatewayDispatchEvents.MessageReactionAdd, {
   member: data.member && data.guild_id ? redis.members.apiToR(data.member, data.guild_id) : null,
   user: data.member?.user
    ? redis.users.apiToR(data.member.user)
    : (await redis.users.get(data.user_id)) || { id: data.user_id },
   burst_colors: data.burst_colors || [],
   message: (await redis.messages.get(data.message_id)) || { id: data.message_id },
   channel: (await redis.channels.get(data.channel_id)) || { id: data.channel_id },
   guild: data.guild_id ? (await redis.guilds.get(data.guild_id)) || { id: data.guild_id } : null,
   emoji: data.emoji.require_colons
    ? `${data.emoji.animated ? 'a:' : ''}${data.emoji.name}:${data.emoji.id}`
    : data.emoji.name!,
   author: (await redis.users.get(data.user_id)) || { id: data.user_id },
  });

  if (!data.guild_id) return;

  const cache = await redis.reactions.get(data.message_id, (data.emoji.id || data.emoji.name)!);

  redis.reactions.set(
   {
    burst_colors: data.burst_colors || [],
    emoji: data.emoji,
    me: cache?.me || false,
    count_details: cache?.count_details
     ? /* eslint-disable indent */
       {
        burst: cache.count_details.burst + (data.burst ? 1 : 0),
        normal: cache.count_details.normal + (data.burst ? 0 : 1),
       }
     : { burst: data.burst ? 1 : 0, normal: data.burst ? 0 : 1 },
    /* eslint-enable indent */
    count: cache?.count ? cache.count + 1 : 1,
    me_burst: cache?.me_burst || data.user_id === process.env.mainId ? data.burst : false,
   },
   data.guild_id,
   data.channel_id,
   data.message_id,
  );
 },

 [GatewayDispatchEvents.MessageReactionRemove]: async (
  data: GatewayMessageReactionRemoveDispatchData,
 ) => {
  emit(GatewayDispatchEvents.MessageReactionRemove, {
   user: (await redis.users.get(data.user_id)) || { id: data.user_id },
   message: (await redis.messages.get(data.message_id)) || { id: data.message_id },
   channel: (await redis.channels.get(data.channel_id)) || { id: data.channel_id },
   guild: data.guild_id ? (await redis.guilds.get(data.guild_id)) || { id: data.guild_id } : null,
   emoji: data.emoji.require_colons
    ? `${data.emoji.animated ? 'a:' : ''}${data.emoji.name}:${data.emoji.id}`
    : data.emoji.name!,
  });

  if (!data.guild_id) return;

  const cache = await redis.reactions.get(data.message_id, (data.emoji.id || data.emoji.name)!);

  redis.reactions.set(
   {
    burst_colors: cache?.burst_colors || [],
    emoji: data.emoji,
    me: cache?.me || false,
    count_details: cache?.count_details
     ? /* eslint-disable indent */
       {
        burst: cache.count_details.burst - (data.burst ? 1 : 0),
        normal: cache.count_details.normal - (data.burst ? 0 : 1),
       }
     : { burst: 0, normal: 0 },
    /* eslint-enable indent */
    count: cache?.count ? cache.count - 1 : 0,
    me_burst: cache?.me_burst || data.user_id === process.env.mainId ? data.burst : false,
   },
   data.guild_id,
   data.channel_id,
   data.message_id,
  );
 },

 [GatewayDispatchEvents.MessageReactionRemoveAll]: async (
  data: GatewayMessageReactionRemoveAllDispatchData,
 ) => {
  const pipeline = RedisClient.pipeline();
  const reactions = await RedisClient.hgetall(redis.reactions.keystore(data.message_id));
  pipeline.hdel(
   redis.reactions.keystore(data.message_id),
   ...Object.keys(reactions).filter((r) => r.includes(data.message_id)),
  );
  pipeline.del(...Object.keys(reactions).filter((r) => r.includes(data.message_id)));
  pipeline.exec();

  emit(GatewayDispatchEvents.MessageReactionRemoveAll, {
   reactions: Object.values(reactions).map((r) => JSON.parse(r) as RReaction),
   message: (await redis.messages.get(data.message_id)) || { id: data.message_id },
   channel: (await redis.channels.get(data.channel_id)) || { id: data.channel_id },
   guild: data.guild_id ? (await redis.guilds.get(data.guild_id)) || { id: data.guild_id } : null,
  });
 },

 [GatewayDispatchEvents.MessageReactionRemoveEmoji]: async (
  data: GatewayMessageReactionRemoveEmojiDispatchData,
 ) => {
  if (!data.guild_id) return;
  const reactions = await RedisClient.hgetall(redis.reactions.keystore(data.guild_id));

  emit(GatewayDispatchEvents.MessageReactionRemoveEmoji, {
   reactions: Object.values(reactions).map((r) => JSON.parse(r) as RReaction),
   message: (await redis.messages.get(data.message_id)) || { id: data.message_id },
   channel: (await redis.channels.get(data.channel_id)) || { id: data.channel_id },
   guild: data.guild_id ? (await redis.guilds.get(data.guild_id)) || { id: data.guild_id } : null,
   emoji: data.emoji.require_colons
    ? `${data.emoji.animated ? 'a:' : ''}${data.emoji.name}:${data.emoji.id}`
    : data.emoji.name!,
  });

  const pipeline = RedisClient.pipeline();
  const filteredReactions = Object.keys(reactions).filter(
   (r) => r.includes(data.message_id) && r.includes((data.emoji.id || data.emoji.name)!),
  );

  pipeline.hdel(redis.reactions.keystore(data.guild_id), ...filteredReactions);
  pipeline.del(...filteredReactions);
  pipeline.exec();
 },
} as const;
