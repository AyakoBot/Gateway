import { Cache } from '@ayako/utility';

const cacheDBnum = process.argv.includes('--dev') ? process.env.devCacheDB : process.env.cacheDB;

const redis = new Cache(Number(cacheDBnum), undefined, false);

export default redis;
