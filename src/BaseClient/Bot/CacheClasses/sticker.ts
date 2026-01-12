/* eslint-disable @typescript-eslint/naming-convention */
import { StickerFormatType, type APISticker } from 'discord-api-types/v10';
import type Redis from 'ioredis';

import type { MakeRequired } from '../../../Typings/Typings';
import type { PipelineBatcher } from '../Redis.js';

import Cache from './Base/Cache.js';

export type RSticker = MakeRequired<APISticker, 'guild_id'> & {
 user_id: string | null;
 url: string;
};

export const RStickerKeys = [
 'id',
 'pack_id',
 'name',
 'description',
 'tags',
 'type',
 'format_type',
 'available',
 'guild_id',
 'sort_value',
 'url',
] as const;

export default class StickerCache extends Cache<APISticker> {
 public keys = RStickerKeys;

 constructor(redis: Redis, batcher: PipelineBatcher) {
  super(redis, 'stickers', batcher);
 }

 public static getUrl(stickerId: string, format: StickerFormatType = StickerFormatType.PNG) {
  return `https://cdn.discordapp.com/stickers/${stickerId}.${String(StickerFormatType[format]).toLowerCase()}`;
 }

 async set(data: APISticker) {
  const rData = this.apiToR(data);
  if (!rData) return false;
  if (!rData.guild_id || !rData.id) return false;

  await this.setValue(rData, [rData.guild_id], [rData.id]);
  return true;
 }

 async get(stickerId: string) {
  return super.get(stickerId);
 }

 apiToR(data: APISticker) {
  const keysNotToCache = Object.keys(data).filter(
   (key): key is keyof typeof data => !this.keys.includes(key as (typeof this.keys)[number]),
  );

  const rData = structuredClone(data) as unknown as RSticker;
  rData.user_id = data.user?.id || null;
  rData.url = StickerCache.getUrl(data.id, data.format_type);

  keysNotToCache.forEach((k) => delete (rData as unknown as Record<string, unknown>)[k as string]);

  return rData;
 }
}
