/* eslint-disable @typescript-eslint/naming-convention */
import type { PipelineBatcher } from '@ayako/service/src/Classes/PipelineBatcher.js';
import type {
 APIGuildScheduledEventUser,
 GatewayGuildScheduledEventUserRemoveDispatchData,
} from 'discord-api-types/v10';
import type Redis from 'ioredis';

import Cache from './Base/Cache.js';

export type REventUser = Omit<APIGuildScheduledEventUser, 'user' | 'member'> & {
 user_id: string;
};

export const REventUserKeys = ['guild_scheduled_event_id', 'user_id'] as const;

export default class EventUserCache extends Cache<APIGuildScheduledEventUser> {
 public keys = REventUserKeys;

 constructor(redis: Redis, batcher: PipelineBatcher) {
  super(redis, 'event-users', batcher);
 }

 async set(
  data: APIGuildScheduledEventUser | GatewayGuildScheduledEventUserRemoveDispatchData,
  guildId: string,
 ) {
  const rData = this.apiToR(data);
  if (!rData) return false;

  await this.setValue(rData, [guildId], [rData.guild_scheduled_event_id, rData.user_id]);
  return true;
 }

 async get(eventId: string) {
  return super.get(eventId);
 }

 apiToR(data: APIGuildScheduledEventUser | GatewayGuildScheduledEventUserRemoveDispatchData) {
  const keysNotToCache = Object.keys(data).filter(
   (key): key is keyof typeof data => !this.keys.includes(key as (typeof this.keys)[number]),
  );

  const rData = structuredClone(data) as unknown as REventUser;
  rData.user_id = 'user' in data ? data.user.id : rData.user_id;

  keysNotToCache.forEach((k) => delete (rData as Record<string, unknown>)[k as string]);

  return rData;
 }
}
