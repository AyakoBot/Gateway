import type Redis from 'ioredis';

import TimeTrackedHashCache from './Base/HashCache.js';

export default class PinCache extends TimeTrackedHashCache {
 constructor(redis: Redis) {
  super(redis, 'pins');
 }

 get(channelId: string, msgId: string) {
  return super.get(channelId, msgId);
 }

 getAll(channelId: string): Promise<Record<string, string>> {
  return super.getAll(channelId);
 }

 getAllAt(time: number, channelId: string): Promise<Record<string, string>> {
  return super.getAllAt(time, channelId);
 }

 getTimes(channelId: string): Promise<number[]> {
  return super.getTimes(channelId);
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
