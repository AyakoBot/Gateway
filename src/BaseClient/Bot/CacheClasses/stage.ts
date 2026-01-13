/* eslint-disable @typescript-eslint/naming-convention */
import type { PipelineBatcher } from '@ayako/service/src/Classes/PipelineBatcher.js';
import type { APIStageInstance } from 'discord-api-types/v10';
import type Redis from 'ioredis';

import Cache from './Base/Cache.js';

export type RStageInstance = APIStageInstance;

export const RStageInstanceKeys = [
 'id',
 'guild_id',
 'channel_id',
 'topic',
 'privacy_level',
 'discoverable_disabled',
 'guild_scheduled_event_id',
] as const;

export default class StageCache extends Cache<APIStageInstance> {
 public keys = RStageInstanceKeys;

 constructor(redis: Redis, batcher: PipelineBatcher) {
  super(redis, 'stages', batcher);
 }

 async set(data: APIStageInstance) {
  const rData = this.apiToR(data);
  if (!rData) return false;
  if (!rData.guild_id || !rData.id) return false;

  await this.setValue(rData, [rData.guild_id], [rData.id]);
  return true;
 }

 async get(stageId: string) {
  return super.get(stageId);
 }

 apiToR(data: APIStageInstance) {
  const keysNotToCache = Object.keys(data).filter(
   (key): key is keyof typeof data => !this.keys.includes(key as (typeof this.keys)[number]),
  );

  keysNotToCache.forEach((k) => delete data[k]);

  return structuredClone(data);
 }
}
