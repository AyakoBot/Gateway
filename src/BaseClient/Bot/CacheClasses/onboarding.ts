/* eslint-disable @typescript-eslint/naming-convention */
import type { APIGuildOnboarding } from 'discord-api-types/v10';
import type Redis from 'ioredis';

import type { PipelineBatcher } from '../Redis.js';

import Cache from './Base/Cache.js';

export type ROnboarding = APIGuildOnboarding;

export const ROnboardingKeys = ['guild_id', 'prompts', 'default_channel_ids', 'mode'] as const;

export default class OnboardingCache extends Cache<APIGuildOnboarding> {
 public keys = ROnboardingKeys;

 constructor(redis: Redis, batcher: PipelineBatcher) {
  super(redis, 'onboarding', batcher);
 }

 async set(data: APIGuildOnboarding) {
  const rData = this.apiToR(data);
  if (!rData) return false;

  await this.setValue(rData, [data.guild_id], [data.guild_id]);
  return true;
 }

 async get(guildId: string) {
  return super.get(guildId);
 }

 apiToR(data: APIGuildOnboarding) {
  const keysNotToCache = Object.keys(data).filter(
   (key): key is keyof typeof data => !this.keys.includes(key as (typeof this.keys)[number]),
  );
  keysNotToCache.forEach((k) => delete data[k]);

  return structuredClone(data) as unknown as ROnboarding;
 }
}
