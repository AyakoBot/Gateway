/* eslint-disable @typescript-eslint/naming-convention */
import type { PipelineBatcher } from '@ayako/service/src/Classes/PipelineBatcher.js';
import type { APIAutoModerationRule } from 'discord-api-types/v10';
import type Redis from 'ioredis';

import Cache from './Base/Cache.js';

export type RAutomod = APIAutoModerationRule;

export const RAutomodKeys = [
 'id',
 'guild_id',
 'name',
 'creator_id',
 'event_type',
 'trigger_type',
 'trigger_metadata',
 'actions',
 'enabled',
 'exempt_roles',
 'exempt_channels',
] as const;

export default class AutomodCache extends Cache<APIAutoModerationRule> {
 public keys = RAutomodKeys;

 constructor(redis: Redis, batcher: PipelineBatcher) {
  super(redis, 'automods', batcher);
 }

 async set(data: APIAutoModerationRule) {
  const rData = this.apiToR(data);
  if (!rData) return false;
  if (!rData.guild_id || !rData.id) return false;

  await this.setValue(rData, [rData.guild_id], [rData.id]);
  return true;
 }

 async get(automodId: string) {
  return super.get(automodId);
 }

 apiToR(data: APIAutoModerationRule) {
  const keysNotToCache = Object.keys(data).filter(
   (key): key is keyof typeof data => !this.keys.includes(key as (typeof this.keys)[number]),
  );

  keysNotToCache.forEach((k) => delete data[k]);
  return structuredClone(data) as RAutomod;
 }
}
