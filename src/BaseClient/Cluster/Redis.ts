import Redis from 'ioredis';

const cacheDBnum = process.argv.includes('--dev') ? process.env.devCacheDB : process.env.cacheDB;
if (!cacheDBnum && typeof cacheDBnum !== 'number') {
 throw new Error('No cache DB number provided in env vars');
}

export const cacheDB = new Redis({ host: 'redis', db: Number(cacheDBnum) });
