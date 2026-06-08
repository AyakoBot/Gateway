/* eslint-disable no-console */

import { ClusterManager } from 'discord-hybrid-sharding';
import 'dotenv/config';

import { bots } from './bots.js';

const managers = bots
 .map((bot) => {
  if (!bot.token) {
   console.warn(`[Cluster Manager] Warning: ${bot.key} has no token. Skipping...`);
   return null;
  }

  console.log(`[Cluster Manager] Spawning ${bot.key} manager`);

  return {
   key: bot.key,
   manager: new ClusterManager('./dist/bot.js', {
    totalShards: 'auto',
    totalClusters: 'auto',
    shardsPerClusters: 10,
    token: bot.token,
    shardArgs: [...process.argv, `--key=${bot.key}`],
    execArgv: [],
    respawn: true,
    mode: 'process',
   }),
  };
 })
 .filter((m) => !!m);

managers.forEach(({ key, manager }) => {
 manager.spawn().catch((e: Response) => {
  console.log(
   `[Cluster Manager] Startup Failed for ${key}. Retry after: ${
    Number(e.headers?.get('retry-after') ?? 0) / 60
   } Minutes`,
  );
  console.error(e);
 });
});

export default managers;
