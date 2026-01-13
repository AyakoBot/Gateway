import { Cache } from '@ayako/utility';

const cacheDBnum = process.argv.includes('--dev') ? process.env.devCacheDB : process.env.cacheDB;

export default new Cache(Number(cacheDBnum), undefined, false);
