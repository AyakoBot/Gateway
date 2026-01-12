/* eslint-disable @typescript-eslint/naming-convention */
import type { APIUser } from 'discord-api-types/v10';
import type Redis from 'ioredis';

import type { PipelineBatcher } from '../Redis.js';

import Cache from './Base/Cache.js';

export type RUser = Omit<APIUser, 'avatar_decoration_data' | 'avatar' | 'banner'> & {
 avatar_decoration_data?: { asset_url: string; sku_id: string };
 avatar_url: string | null;
 banner_url: string | null;
};

const RUserKeys = [
 'id',
 'username',
 'discriminator',
 'global_name',
 'avatar_url',
 'bot',
 'system',
 'banner_url',
 'accent_color',
 'verified',
 'flags',
 'public_flags',
 'avatar_decoration_data',
] as const;

export default class UserCache extends Cache<APIUser> {
 public keys = RUserKeys;

 constructor(redis: Redis, batcher: PipelineBatcher) {
  super(redis, 'users', batcher);
 }

 public static assetUrl(asset: string) {
  return `https://cdn.discordapp.com/avatar-decoration-presets/${asset}.png`;
 }

 public static avatarUrl(avatar: string, userId: string) {
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${avatar.startsWith('a_') ? 'gif' : 'webp'}`;
 }

 public static bannerUrl(banner: string, userId: string) {
  return `https://cdn.discordapp.com/banners/${userId}/${banner}.${banner.startsWith('a_') ? 'gif' : 'webp'}`;
 }

 async set(data: APIUser) {
  const rData = this.apiToR(data);
  if (!rData) return false;
  if (!rData.id) return false;

  await this.setValue(rData, [], [rData.id]);
  return true;
 }

 async get(userId: string) {
  return super.get(userId);
 }

 apiToR(data: APIUser) {
  const keysNotToCache = Object.keys(data).filter(
   (key): key is keyof typeof data => !this.keys.includes(key as (typeof this.keys)[number]),
  );

  const rData = structuredClone(data) as unknown as RUser;
  rData.avatar_decoration_data = data.avatar_decoration_data
   ? {
      asset_url: UserCache.assetUrl(data.avatar_decoration_data.asset),
      sku_id: data.avatar_decoration_data.sku_id,
     }
   : undefined;
  rData.avatar_url = data.avatar ? UserCache.avatarUrl(data.avatar, data.id) : null;
  rData.banner_url = data.banner ? UserCache.bannerUrl(data.banner, data.id) : null;

  keysNotToCache.forEach((k) => delete (rData as Record<string, unknown>)[k as string]);

  return rData;
 }
}
