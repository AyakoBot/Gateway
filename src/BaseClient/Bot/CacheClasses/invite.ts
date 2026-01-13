/* eslint-disable @typescript-eslint/naming-convention */
import type { PipelineBatcher } from '@ayako/service/src/Classes/PipelineBatcher.js';
import type { APIExtendedInvite, APIInvite } from 'discord-api-types/v10';
import type Redis from 'ioredis';

import Cache from './Base/Cache.js';

export type RInvite = Omit<
 APIExtendedInvite,
 'guild' | 'channel' | 'inviter' | 'target_user' | 'guild_scheduled_event' | 'stage_instance'
> & {
 guild_id: string;
 channel_id: string | null;
 inviter_id: string | null;
 target_user_id: string | null;
 guild_scheduled_event_id: string | null;
 application_id: string | null;
};

export const RInviteKeys = [
 'code',
 'target_type',
 'approximate_presence_count',
 'approximate_member_count',
 'expires_at',
 'type',
 'guild_id',
 'channel_id',
 'inviter_id',
 'target_user_id',
 'guild_scheduled_event_id',
 'application_id',
 'uses',
 'max_uses',
 'max_age',
 'temporary',
 'created_at',
] as const;

export default class InviteCache extends Cache<APIInvite | APIExtendedInvite> {
 public keys = RInviteKeys;
 private codestorePrefix: string;

 constructor(redis: Redis, batcher: PipelineBatcher) {
  super(redis, 'invites', batcher);
  this.codestorePrefix = 'codestore:invites';
 }

 codestore(...ids: string[]) {
  return `${this.codestorePrefix}${ids.length ? `:${ids.join(':')}` : ''}`;
 }

 async set(data: APIInvite | APIExtendedInvite) {
  const rData = this.apiToR(data);
  if (!rData) return false;
  if (!rData.guild_id || !rData.code || !rData.channel_id) return false;

  await this.setValue(rData, [rData.guild_id], [rData.channel_id, rData.code]);

  const guildCodestoreKey = this.codestore(rData.guild_id);
  const globalCodestoreKey = this.codestore();
  const location = `${rData.guild_id}:${rData.channel_id}`;
  const ttl = 604800;

  const pipeline = this.redis.pipeline();
  pipeline.hset(guildCodestoreKey, rData.code, rData.channel_id);
  pipeline.hexpire(guildCodestoreKey, ttl, 'FIELDS', 1, rData.code);
  pipeline.hset(globalCodestoreKey, rData.code, location);
  pipeline.hexpire(globalCodestoreKey, ttl, 'FIELDS', 1, rData.code);
  await pipeline.exec();

  return true;
 }

 async get(channelId: string, code: string) {
  return super.get(channelId, code);
 }

 async getAllCodes(guildId: string): Promise<string[]> {
  const guildCodestoreKey = this.codestore(guildId);
  return this.redis.hkeys(guildCodestoreKey);
 }

 async search(code: string): Promise<RInvite | null> {
  const location = await this.redis.hget(this.codestore(), code);
  if (!location) return null;

  const [guildId, channelId] = location.split(':');
  if (!guildId || !channelId) return null;

  return this.get(channelId, code);
 }

 async del(channelId: string, code: string, guildId?: string) {
  if (!guildId) {
   const location = await this.redis.hget(this.codestore(), code);
   if (location) [guildId] = location.split(':');
  }

  const pipeline = this.redis.pipeline();

  pipeline.del(this.key(channelId, code, 'current'));

  if (guildId) {
   const guildCodestoreKey = this.codestore(guildId);
   pipeline.hdel(guildCodestoreKey, code);
  }

  pipeline.hdel(this.codestore(), code);

  await pipeline.exec();
  return 1;
 }

 apiToR(data: APIInvite) {
  if (!data.guild) return false;

  const keysNotToCache = Object.keys(data).filter(
   (key): key is keyof typeof data => !this.keys.includes(key as (typeof this.keys)[number]),
  );

  const rData = structuredClone(data) as unknown as RInvite;
  rData.guild_id = data.guild.id;
  rData.channel_id = data.channel?.id || null;
  rData.inviter_id = data.inviter?.id || null;
  rData.guild_scheduled_event_id = data.guild_scheduled_event?.id || null;
  rData.application_id = data.target_application?.id || null;
  rData.target_user_id = data.target_user?.id || null;

  keysNotToCache.forEach((k) => delete (rData as Record<string, unknown>)[k as string]);

  return rData;
 }
}
