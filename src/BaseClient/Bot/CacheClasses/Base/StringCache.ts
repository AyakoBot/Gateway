import type Redis from 'ioredis';

export default class StringCache {
 protected prefix: string;
 protected historyPrefix: string;
 public redis: Redis;

 private dedupeScript = `
 local cacheKey = KEYS[1]
 local historyKey = KEYS[2]
 local id = ARGV[1]
 local value = ARGV[2]
 local ttl = tonumber(ARGV[3])
 local timestamp = ARGV[4]

 local currentKey = id .. ":current"
 local previousValue = redis.call('HGET', cacheKey, currentKey)

 -- Set current value
 redis.call('HSET', cacheKey, currentKey, value)
 redis.call('HEXPIRE', cacheKey, ttl, 'FIELDS', 1, currentKey)

 -- Only create snapshot if value changed
 if previousValue ~= value then
  local timestampKey = id .. ":" .. timestamp
  redis.call('HSET', cacheKey, timestampKey, value)
  redis.call('HEXPIRE', cacheKey, ttl, 'FIELDS', 1, timestampKey)
  redis.call('HSET', historyKey, id, timestamp)
  redis.call('HEXPIRE', historyKey, ttl, 'FIELDS', 1, id)
  return 1
 end

 return 0
 `;

 constructor(redis: Redis, type: string) {
  this.prefix = `cache:${type}`;
  this.historyPrefix = `history:${type}`;
  this.redis = redis;
 }

 get(keystoreId: string, id: string): Promise<string | null> {
  return this.redis.hget(this.key(keystoreId), `${id}:current`);
 }

 async getAll(keystoreId: string): Promise<Record<string, string>> {
  const all = await this.redis.hgetall(this.key(keystoreId));
  const current: Record<string, string> = {};

  for (const [key, value] of Object.entries(all)) {
   if (key.endsWith(':current')) {
    const id = key.slice(0, -8);
    current[id] = value;
   }
  }

  return current;
 }

 key(id: string) {
  return `${this.prefix}:${id}`;
 }

 history(id: string): string {
  return `${this.historyPrefix}:${id}`;
 }

 async set(keystoreId: string, id: string, value: string, ttl: number = 604800) {
  const timestamp = Date.now();
  return this.redis.eval(
   this.dedupeScript,
   2,
   this.key(keystoreId),
   this.history(keystoreId),
   id,
   value,
   ttl,
   timestamp,
  );
 }

 async getAt(keystoreId: string, id: string, timestamp: number): Promise<string | null> {
  return this.redis.hget(this.key(keystoreId), `${id}:${timestamp}`);
 }

 async getTimes(keystoreId: string, id: string): Promise<number[]> {
  const latestTimestamp = await this.redis.hget(this.history(keystoreId), id);
  if (!latestTimestamp) return [];

  const allKeys = await this.redis.hkeys(this.key(keystoreId));
  const timestamps = allKeys
   .filter((key) => key.startsWith(`${id}:`) && key !== `${id}:current`)
   .map((key) => Number(key.split(':')[1]))
   .filter((ts) => !isNaN(ts))
   .sort((a, b) => a - b);

  return timestamps;
 }

 del(keystoreId: string, id: string) {
  return this.redis.hdel(this.key(keystoreId), `${id}:current`);
 }

 delAll(keystoreId: string) {
  return this.redis.del(this.key(keystoreId));
 }
}
