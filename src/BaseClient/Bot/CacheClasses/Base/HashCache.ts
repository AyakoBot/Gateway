import type Redis from 'ioredis';

import StringCache from './StringCache.js';

export default class TimeTrackedHashCache extends StringCache {
 private dedupeHashScript = `
 local currentKey = KEYS[1]
 local timestampKey = KEYS[2]
 local historyKey = KEYS[3]
 local ttl = tonumber(ARGV[1])
 local timestamp = ARGV[2]

 -- Get current hash
 local currentHash = redis.call('HGETALL', currentKey)

 -- Convert array to table for comparison
 local function arrayToTable(arr)
   local t = {}
   for i = 1, #arr, 2 do
     t[arr[i]] = arr[i + 1]
   end
   return t
 end

 local function tableToSortedJson(t)
   local keys = {}
   for k in pairs(t) do
     table.insert(keys, k)
   end
   table.sort(keys)

   local parts = {}
   for _, k in ipairs(keys) do
     table.insert(parts, string.format('"%s":"%s"', k, t[k]))
   end
   return "{" .. table.concat(parts, ",") .. "}"
 end

 -- Get new hash
 local newHash = redis.call('HGETALL', currentKey)

 -- Compare hashes
 local currentTable = arrayToTable(currentHash)
 local newTable = arrayToTable(newHash)

 local currentJson = tableToSortedJson(currentTable)
 local newJson = tableToSortedJson(newTable)

 if currentJson == newJson and #currentHash > 0 then
   redis.call('EXPIRE', currentKey, ttl)
   return 0
 end

 -- Copy current hash to timestamp key
 if #newHash > 0 then
   redis.call('DEL', timestampKey)
   for i = 1, #newHash, 2 do
     redis.call('HSET', timestampKey, newHash[i], newHash[i + 1])
   end
   redis.call('EXPIRE', timestampKey, ttl)
   redis.call('HSET', historyKey, timestamp, timestamp)
   redis.call('HEXPIRE', historyKey, ttl, 'FIELDS', 1, timestamp)
 end

 redis.call('EXPIRE', currentKey, ttl)
 return 1
  `;

 constructor(redis: Redis, type: string) {
  super(redis, type);
 }

 override key(...ids: string[]): string {
  return `${this.prefix}${ids.length ? `:${ids.join(':')}` : ''}`;
 }

 override history(...ids: string[]): string {
  return `${this.historyPrefix}${ids.length ? `:${ids.join(':')}` : ''}`;
 }

 override async get(keystoreId: string, id: string): Promise<string | null> {
  return this.redis.hget(this.key(keystoreId, 'current'), id);
 }

 override async getAll(keystoreId: string): Promise<Record<string, string>> {
  return this.redis.hgetall(this.key(keystoreId, 'current'));
 }

 async getAllAt(time: number, keystoreId: string): Promise<Record<string, string>> {
  return this.redis.hgetall(this.key(keystoreId, String(time)));
 }

 async getTimes(keystoreId: string): Promise<number[]> {
  return this.redis.hkeys(this.history(keystoreId)).then((times) => times.map((t) => Number(t)));
 }

 override async set(keystoreId: string, id: string, value: string, ttl: number = 604800) {
  const pipeline = this.redis.pipeline();
  pipeline.hset(this.key(keystoreId, 'current'), id, value);
  pipeline.call('hexpire', this.key(keystoreId, 'current'), id, ttl);
  const result = await pipeline.exec();
  await this.snapshot(keystoreId, ttl);
  return result;
 }

 async snapshot(keystoreId: string, ttl: number = 604800) {
  const now = Date.now();
  const currentKey = this.key(keystoreId, 'current');
  const timestampKey = this.key(keystoreId, String(now));
  const historyKey = this.history(keystoreId);

  return this.redis.eval(this.dedupeHashScript, 3, currentKey, timestampKey, historyKey, ttl, now);
 }

 override async del(keystoreId: string, id: string) {
  const result = await this.redis.hdel(this.key(keystoreId, 'current'), id);
  await this.snapshot(keystoreId);
  return result;
 }

 override async delAll(keystoreId: string) {
  return this.redis.del(this.key(keystoreId, 'current'));
 }
}
