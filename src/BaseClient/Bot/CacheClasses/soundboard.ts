import type { APISoundboardSound } from 'discord-api-types/v10';
import type Redis from 'ioredis';

import Cache from './Base/Cache.js';

export type RSoundboardSound = Omit<APISoundboardSound, 'user' | 'guild_id'> & {
 user_id: string | null;
 guild_id: string;
};

export const RSoundboardSoundKeys = [
 'name',
 'sound_id',
 'volume',
 'emoji_id',
 'emoji_name',
 'guild_id',
 'available',
 'user_id',
] as const;

export default class SoundboardCache extends Cache<APISoundboardSound> {
 public keys = RSoundboardSoundKeys;

 constructor(redis: Redis) {
  super(redis, 'soundboards');
 }

 async set(data: APISoundboardSound) {
  const rData = this.apiToR(data);
  if (!rData) return false;
  if (!rData.guild_id || !rData.sound_id) return false;

  await this.setValue(rData, [rData.guild_id], [rData.sound_id]);
  return true;
 }

 async get(soundId: string) {
  return super.get(soundId);
 }

 apiToR(data: APISoundboardSound) {
  const keysNotToCache = Object.keys(data).filter(
   (key): key is keyof typeof data => !this.keys.includes(key),
  );

  const rData = structuredClone(data) as unknown as RSoundboardSound;
  rData.user_id = data.user?.id || null;

  keysNotToCache.forEach((k) => delete (rData as Record<string, unknown>)[k as string]);

  return rData;
 }
}
