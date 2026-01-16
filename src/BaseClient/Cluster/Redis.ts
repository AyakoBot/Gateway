import { createRedisWrapper } from '@ayako/utility';

const cacheDBnum = process.argv.includes('--dev') ? process.env.devCacheDB : process.env.cacheDB;
if (!cacheDBnum && typeof cacheDBnum !== 'number') {
 throw new Error('No cache DB number provided in env vars');
}

export const cacheDB = createRedisWrapper({
 host: process.argv.includes('--local') ? 'localhost' : 'redis',
 db: Number(cacheDBnum),
});
