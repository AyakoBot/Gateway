import { Cache } from '@ayako/utility';

const cacheDBnum = process.argv.includes('--dev') ? process.env.devCacheDB : process.env.cacheDB;

const redis = new Cache(Number(cacheDBnum), undefined, false);

setInterval(() => {
 const heapMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
 if (heapMB > 500) {
  console.warn('[Memory] High usage:', heapMB, 'MB - triggering recycle');
  redis.recycleConnection().catch(console.error);
 }
}, 60000);

export default redis;
