/* eslint-disable @typescript-eslint/naming-convention */
import type { APIEmoji } from 'discord-api-types/v10';
import type Redis from 'ioredis';

import type { PipelineBatcher } from '../Redis.js';

import Cache from './Base/Cache.js';

export type REmoji = Omit<APIEmoji, 'user' | 'id'> & {
 user_id: string | null;
 guild_id: string;
 id: string;
 url: string;
};

export const REmojiKeys = [
 'id',
 'name',
 'animated',
 'roles',
 'user_id',
 'require_colons',
 'managed',
 'guild_id',
 'url',
] as const;

export default class EmojiCache extends Cache<APIEmoji> {
 public keys = REmojiKeys;

 constructor(redis: Redis, batcher: PipelineBatcher) {
  super(redis, 'emojis', batcher);
 }

 public static getUrl(emojiId: string, animated: boolean = false) {
  return `https://cdn.discordapp.com/emojis/${emojiId}.${animated ? 'gif' : 'webp'}`;
 }

 async set(data: APIEmoji, guildId: string) {
  const rData = this.apiToR(data, guildId);
  if (!rData) return false;
  if (!rData.guild_id || !rData.id) return false;

  await this.setValue(rData, [rData.guild_id], [rData.id]);
  return true;
 }

 async get(emojiId: string) {
  return super.get(emojiId);
 }

 apiToR(data: APIEmoji, guildId: string) {
  const keysNotToCache = Object.keys(data).filter(
   (key): key is keyof typeof data => !this.keys.includes(key as (typeof this.keys)[number]),
  );

  const rData = structuredClone(data) as unknown as REmoji;
  rData.guild_id = guildId;
  rData.user_id = data.user?.id || null;
  rData.url = EmojiCache.getUrl(data.id!, !!data.animated);

  keysNotToCache.forEach((k) => delete (rData as Record<string, unknown>)[k as string]);

  return rData as REmoji;
 }
}
