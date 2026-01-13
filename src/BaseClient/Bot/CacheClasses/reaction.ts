/* eslint-disable @typescript-eslint/naming-convention */
import type { PipelineBatcher } from '@ayako/service/src/Classes/PipelineBatcher.js';
import type { APIReaction } from 'discord-api-types/v10';
import type Redis from 'ioredis';

import Cache from './Base/Cache.js';

export type RReaction = APIReaction & { guild_id: string; channel_id: string; message_id: string };

export const RReactionKeys = [
 'count',
 'count_details',
 'me',
 'me_burst',
 'emoji',
 'burst_colors',
 'guild_id',
 'message_id',
] as const;

export default class ReactionCache extends Cache<APIReaction> {
 public keys = RReactionKeys;

 constructor(redis: Redis, batcher: PipelineBatcher) {
  super(redis, 'reactions', batcher);
 }

 async set(data: APIReaction, guildId: string, channelId: string, messageId: string) {
  const rData = this.apiToR(data, guildId, channelId, messageId);
  if (!rData) return false;
  const emojiKey = data.emoji.id || data.emoji.name;
  if (!rData.guild_id || !rData.channel_id || !rData.message_id || !emojiKey) return false;

  await this.setValue(
   rData,
   [rData.guild_id],
   [rData.channel_id, rData.message_id, emojiKey],
  );
  return true;
 }

 async get(channelId: string, messageId: string, emojiId: string) {
  return super.get(channelId, messageId, emojiId);
 }

 apiToR(data: APIReaction, guildId: string, channelId: string, messageId: string) {
  const keysNotToCache = Object.keys(data).filter(
   (key): key is keyof typeof data => !this.keys.includes(key as (typeof this.keys)[number]),
  );

  const rData = structuredClone(data) as unknown as RReaction;
  rData.guild_id = guildId;
  rData.channel_id = channelId;
  rData.message_id = messageId;

  keysNotToCache.forEach((k) => delete (rData as unknown as Record<string, unknown>)[k as string]);

  return rData;
 }
}
