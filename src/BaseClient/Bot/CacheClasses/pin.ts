import type Redis from 'ioredis';

import { StringCache } from './base.js';

// TODO: time tables
export default class PinCache extends StringCache {
 constructor(redis: Redis) {
  super(redis, 'pins');
 }

 get(channelId: string, msgId: string) {
  return super.get(channelId, msgId);
 }

 getAll(channelId: string): Promise<Record<string, string>> {
  return super.getAll(channelId);
 }

 set(channelId: string, msgId: string) {
  return super.set(channelId, msgId, msgId);
 }

 del(channelId: string, msgId: string) {
  return super.del(channelId, msgId);
 }

 delAll(channelId: string) {
  return super.delAll(channelId);
 }
}
