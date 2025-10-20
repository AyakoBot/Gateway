import type { APIGuildOnboarding } from 'discord-api-types/v10';
import type Redis from 'ioredis';

import Cache from './Base/Cache.js';

export type ROnboarding = APIGuildOnboarding;

export const ROnboardingKeys = ['guild_id', 'prompts', 'default_channel_ids', 'mode'] as const;

export default class OnboardingCache extends Cache<APIGuildOnboarding> {
 public keys = ROnboardingKeys;

 constructor(redis: Redis) {
  super(redis, 'onboarding');
 }

 async set(data: APIGuildOnboarding, guildId: string) {
  const rData = this.apiToR(data);
  if (!rData) return false;
  if (!guildId) return false;

  await this.setValue(rData, [guildId], [guildId]);
  return true;
 }

 async get(guildId: string) {
  return super.get(guildId);
 }

 apiToR(data: APIGuildOnboarding) {
  const keysNotToCache = Object.keys(data).filter(
   (key): key is keyof typeof data => !this.keys.includes(key),
  );
  keysNotToCache.forEach((k) => delete data[k]);

  return structuredClone(data) as unknown as ROnboarding;
 }
}
