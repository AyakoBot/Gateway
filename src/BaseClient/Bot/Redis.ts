import { Cache } from '@ayako/service/Classes/Cache.js';

const cacheDBnum = process.argv.includes('--dev') ? process.env.devCacheDB : process.env.cacheDB;

export default new Cache(Number(cacheDBnum));
