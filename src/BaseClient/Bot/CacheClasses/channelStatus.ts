import type Redis from 'ioredis';

import StringCache from './Base/StringCache.js';

export default class ChannelStatusCache extends StringCache {
 constructor(redis: Redis) {
  super(redis, 'channels-statuses');
 }

 set(guildId: string, channelId: string, status: string, ttl?: number) {
  return super.set(guildId, channelId, status, ttl);
 }

 get(guildId: string, channelId: string) {
  return super.get(guildId, channelId);
 }

 getAll(guildId: string) {
  return super.getAll(guildId);
 }

 del(guildId: string, channelId: string) {
  return super.del(guildId, channelId);
 }

 delAll(guildId: string) {
  return super.delAll(guildId);
 }
}
