/* eslint-disable no-console */
import { currentKey, dedupeEnabled } from '../../Cluster/bots.js';
import redis from '../Cache.js';

const guildKey = (guildId: string) => `gw:presence:${guildId}`;
const sharedSetKey = 'gw:shared';
const sharedGuilds = new Set<string>();
const presenceCache = new Map<string, { keys: string[]; at: number }>();
let refreshTimer: ReturnType<typeof setInterval> | null = null;

export const isShared = (guildId: string): boolean => sharedGuilds.has(guildId);

export const presenceOf = async (guildId: string): Promise<string[]> => {
 const now = Date.now();
 const cached = presenceCache.get(guildId);
 if (cached && now - cached.at < 15000) return cached.keys;

 const keys = ((await redis.cacheDb.call('SMEMBERS', guildKey(guildId))) as string[]) ?? [];
 presenceCache.set(guildId, { keys, at: now });
 return keys;
};

export const addPresence = async (guildId: string): Promise<void> => {
 const pipeline = redis.cacheDb.pipeline();
 pipeline.call('SADD', guildKey(guildId), currentKey);
 pipeline.call('SCARD', guildKey(guildId));
 const res = await pipeline.exec();

 presenceCache.delete(guildId);

 const card = Number((res?.[1]?.[1] as number) ?? 0);
 if (card >= 2) {
  await redis.cacheDb.call('SADD', sharedSetKey, guildId);
  sharedGuilds.add(guildId);
 }
};

export const removePresence = async (guildId: string): Promise<void> => {
 const pipeline = redis.cacheDb.pipeline();
 pipeline.call('SREM', guildKey(guildId), currentKey);
 pipeline.call('SCARD', guildKey(guildId));
 const res = await pipeline.exec();

 presenceCache.delete(guildId);

 const card = Number((res?.[1]?.[1] as number) ?? 0);
 if (card < 2) {
  await redis.cacheDb.call('SREM', sharedSetKey, guildId);
  sharedGuilds.delete(guildId);
 }
};

const refreshShared = async (): Promise<void> => {
 try {
  const members = ((await redis.cacheDb.call('SMEMBERS', sharedSetKey)) as string[]) ?? [];
  sharedGuilds.clear();
  for (const g of members) sharedGuilds.add(g);
 } catch (err) {
  console.error('[Dedupe] Failed to refresh shared guilds:', err);
 }
};

export const startPresenceSync = () => {
 if (!dedupeEnabled || refreshTimer) return;
 refreshShared();
 refreshTimer = setInterval(() => refreshShared(), 10000);
};
