/* eslint-disable @typescript-eslint/naming-convention */
import type { PipelineBatcher } from '@ayako/service/src/Classes/PipelineBatcher.js';
import type { APIGuildWelcomeScreen } from 'discord-api-types/v10';
import type Redis from 'ioredis';

import Cache from './Base/Cache.js';

export type RWelcomeScreen = APIGuildWelcomeScreen;

export const RWelcomeScreenKeys = ['description', 'welcome_channels'] as const;

export default class WelcomeScreenCache extends Cache<APIGuildWelcomeScreen> {
 public keys = RWelcomeScreenKeys;

 constructor(redis: Redis, batcher: PipelineBatcher) {
  super(redis, 'welcome-screens', batcher);
 }

 async set(data: APIGuildWelcomeScreen, guildId: string) {
  const rData = this.apiToR(data);
  if (!rData) return false;
  if (!guildId) return false;

  await this.setValue(rData, [guildId], [guildId]);
  return true;
 }

 async get(guildId: string) {
  return super.get(guildId);
 }

 apiToR(data: APIGuildWelcomeScreen) {
  const keysNotToCache = Object.keys(data).filter(
   (key): key is keyof typeof data => !this.keys.includes(key as (typeof this.keys)[number]),
  );
  keysNotToCache.forEach((k) => delete data[k]);

  return structuredClone(data) as unknown as RWelcomeScreen;
 }
}
