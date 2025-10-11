import type { APIGuildWelcomeScreen } from 'discord-api-types/v10';
import type Redis from 'ioredis';

import Cache from './base.js';

export type RWelcomeScreen = APIGuildWelcomeScreen;

export const RWelcomeScreenKeys = ['description', 'welcome_channels'] as const;

export default class WelcomeScreenCache extends Cache<APIGuildWelcomeScreen> {
 public keys = RWelcomeScreenKeys;

 constructor(redis: Redis) {
  super(redis, 'welcome-screens');
 }

 async set(data: APIGuildWelcomeScreen, guildId: string) {
  const rData = this.apiToR(data);
  if (!rData) return false;

  await this.setValue(rData, [guildId], [guildId]);
  return true;
 }

 async get(guildId: string) {
  return super.get(guildId);
 }

 apiToR(data: APIGuildWelcomeScreen) {
  const keysNotToCache = Object.keys(data).filter(
   (key): key is keyof typeof data => !this.keys.includes(key),
  );
  keysNotToCache.forEach((k) => delete data[k]);

  return structuredClone(data) as unknown as RWelcomeScreen;
 }
}
