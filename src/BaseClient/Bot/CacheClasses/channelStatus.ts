import type Redis from 'ioredis';

import { StringCache } from './base.js';

// TODO: time tables
export default class ChannelStatusCache extends StringCache {
 constructor(redis: Redis) {
  super(redis, 'channels-statuses');
 }

 get(guildId: string, channelId: string) {
  return super.get(guildId, channelId);
 }

 getAll(guildId: string): Promise<Record<string, string>> {
  return super.getAll(guildId);
 }

 set(guildId: string, channelId: string, status: string) {
  return super.set(guildId, channelId, status);
 }

 del(guildId: string, channelId: string) {
  return super.del(guildId, channelId);
 }

 delAll(guildId: string) {
  return super.delAll(guildId);
 }
}
