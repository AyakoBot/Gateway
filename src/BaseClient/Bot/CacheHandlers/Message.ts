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
} from 'discord-api-types/gateway/v10';

import { AllThreadGuildChannelTypes } from '../../../Typings/Channel.js';
import evalFn from '../../../Util/eval.js';
import firstGuildInteraction from '../../../Util/firstGuildInteraction.js';
import redis from '../Cache.js';

export default {
 [GatewayDispatchEvents.MessageCreate]: async (
  data: GatewayMessageCreateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (data.guild_id) {
   p.push(redis.messages.set(data, data.guild_id || '@me'));

   p.push(firstGuildInteraction(data.guild_id));
  }

  if (!data.webhook_id) p.push(redis.users.set(data.author));

  p.push(evalFn(data));

  if (!AllThreadGuildChannelTypes.includes(data.type)) return p;

  p.push(
   redis.threads.get(data.channel_id).then((cache) => {
    if (cache) {
     return redis.threads.set({ ...cache, message_count: (cache.message_count || 0) + 1 });
    }

    return new Promise((res) => res(void 0));
   }),
  );

  return p;
 },

 [GatewayDispatchEvents.MessageDelete]: async (
  data: GatewayMessageDeleteDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (data.guild_id) p.push(firstGuildInteraction(data.guild_id));

  p.push(redis.messages.del(data.channel_id, data.id));
  p.push(redis.pins.del(data.channel_id, data.id));

  return p;
 },

 [GatewayDispatchEvents.MessageDeleteBulk]: async (
  data: GatewayMessageDeleteBulkDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (data.guild_id) p.push(firstGuildInteraction(data.guild_id));

  data.ids.forEach((id) => {
   p.push(redis.messages.del(data.channel_id, id));
   p.push(redis.pins.del(data.channel_id, id));
  });

  return p;
 },

 [GatewayDispatchEvents.MessageUpdate]: async (
  data: GatewayMessageUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (!data.guild_id) return p;

  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.messages.set(data, data.guild_id));

  return p;
 },

 [GatewayDispatchEvents.MessagePollVoteAdd]: async (
  data: GatewayMessagePollVoteDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (!data.guild_id) return p;

  p.push(firstGuildInteraction(data.guild_id));
  return p;
 },

 [GatewayDispatchEvents.MessagePollVoteRemove]: async (
  data: GatewayMessagePollVoteDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (!data.guild_id) return p;
  p.push(firstGuildInteraction(data.guild_id));
  return p;
 },

 [GatewayDispatchEvents.MessageReactionAdd]: async (
  data: GatewayMessageReactionAddDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (data.member && data.guild_id) p.push(redis.members.set(data.member, data.guild_id));

  if (data.member?.user) p.push(redis.users.set(data.member.user));

  if (!data.guild_id) return p;

  p.push(firstGuildInteraction(data.guild_id));

  const cache = await redis.reactions.get(
   data.channel_id,
   data.message_id,
   (data.emoji.id || data.emoji.name)!,
  );

  p.push(
   redis.reactions.set(
    {
     burst_colors: data.burst_colors || [],
     emoji: data.emoji,
     me: cache?.me || false,
     count_details: cache?.count_details
      ? {
         burst: cache.count_details.burst + (data.burst ? 1 : 0),
         normal: cache.count_details.normal + (data.burst ? 0 : 1),
        }
      : { burst: data.burst ? 1 : 0, normal: data.burst ? 0 : 1 },
     count: cache?.count ? cache.count + 1 : 1,
     me_burst: cache?.me_burst || data.user_id === process.env.mainId ? data.burst : false,
    },
    data.guild_id,
    data.channel_id,
    data.message_id,
   ),
  );

  return p;
 },

 [GatewayDispatchEvents.MessageReactionRemove]: async (
  data: GatewayMessageReactionRemoveDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (!data.guild_id) return p;

  p.push(firstGuildInteraction(data.guild_id));

  const cache = await redis.reactions.get(
   data.channel_id,
   data.message_id,
   (data.emoji.id || data.emoji.name)!,
  );

  p.push(
   redis.reactions.set(
    {
     burst_colors: cache?.burst_colors || [],
     emoji: data.emoji,
     me: cache?.me || false,
     count_details: cache?.count_details
      ? {
         burst: cache.count_details.burst - (data.burst ? 1 : 0),
         normal: cache.count_details.normal - (data.burst ? 0 : 1),
        }
      : { burst: 0, normal: 0 },

     count: cache?.count ? cache.count - 1 : 0,
     me_burst: cache?.me_burst || data.user_id === process.env.mainId ? data.burst : false,
    },
    data.guild_id,
    data.channel_id,
    data.message_id,
   ),
  );

  return p;
 },

 [GatewayDispatchEvents.MessageReactionRemoveAll]: async (
  data: GatewayMessageReactionRemoveAllDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (data.guild_id) p.push(firstGuildInteraction(data.guild_id));

  const reactionKeys = await redis.cacheDb.hscanKeys(
   redis.reactions.keystore(data.message_id),
   `*${data.message_id}*`,
  );

  if (reactionKeys.length === 0) return p;

  const pipeline = redis.cacheDb.pipeline();
  pipeline.hdel(redis.reactions.keystore(data.message_id), ...reactionKeys);
  pipeline.del(...reactionKeys);
  p.push(pipeline.exec());

  return p;
 },

 [GatewayDispatchEvents.MessageReactionRemoveEmoji]: async (
  data: GatewayMessageReactionRemoveEmojiDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (!data.guild_id) return p;
  p.push(firstGuildInteraction(data.guild_id));

  const emojiId = data.emoji.id || data.emoji.name;
  const reactionKeys = await redis.cacheDb.hscanKeys(
   redis.reactions.keystore(data.guild_id),
   `*${data.message_id}*`,
  );

  const filteredReactions = reactionKeys.filter((r) => r.includes(emojiId!));

  if (filteredReactions.length === 0) return p;

  const pipeline = redis.cacheDb.pipeline();
  pipeline.hdel(redis.reactions.keystore(data.guild_id), ...filteredReactions);
  pipeline.del(...filteredReactions);
  p.push(pipeline.exec());

  return p;
 },
} as const;
