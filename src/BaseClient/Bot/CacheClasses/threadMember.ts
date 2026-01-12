/* eslint-disable @typescript-eslint/naming-convention */
import type { APIThreadMember } from 'discord-api-types/v10';
import type Redis from 'ioredis';

import type { PipelineBatcher } from '../Redis.js';

import Cache from './Base/Cache.js';

export type RThreadMember = Omit<APIThreadMember, 'member'> & {
 guild_id: string;
 user_id: string;
 id: string;
};

export const RThreadMemberKeys = ['id', 'user_id', 'join_timestamp', 'flags', 'guild_id'] as const;

export default class ThreadMemberCache extends Cache<APIThreadMember> {
 public keys = RThreadMemberKeys;

 constructor(redis: Redis, batcher: PipelineBatcher) {
  super(redis, 'thread-members', batcher);
 }

 async set(data: APIThreadMember, guildId: string) {
  const rData = this.apiToR(data, guildId);
  if (!rData) return false;
  if (!rData.guild_id || !rData.id || !rData.user_id) return false;

  await this.setValue(rData, [rData.guild_id], [rData.guild_id, rData.id, rData.user_id]);
  return true;
 }

 async get(guildId: string, threadId: string, userId: string) {
  return super.get(guildId, threadId, userId);
 }

 apiToR(data: APIThreadMember, guildId: string) {
  if (!data.member?.user.id && !data.user_id) return false;
  if (!data.id) return false;

  const keysNotToCache = Object.keys(data).filter(
   (key): key is keyof typeof data => !this.keys.includes(key as (typeof this.keys)[number]),
  );

  const rData = structuredClone(data) as unknown as RThreadMember;
  rData.user_id = (data.member?.user.id || data.user_id)!;
  rData.guild_id = guildId;

  keysNotToCache.forEach((k) => delete (rData as Record<string, unknown>)[k as string]);

  return rData;
 }
}
