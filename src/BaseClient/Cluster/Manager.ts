/* eslint-disable no-console */

import { ClusterManager } from 'discord-hybrid-sharding';
import 'dotenv/config';

const Manager = new ClusterManager('./dist/bot.js', {
 totalShards: 'auto',
 totalClusters: 'auto',
 shardsPerClusters: 10,
 token: (process.argv.includes('--dev') ? process.env.DevToken : process.env.Token) ?? '',
 shardArgs: process.argv,
 execArgv: [
  '--max-old-space-size=2048',
  '--experimental-json-modules',
  ...(process.argv.includes('--dev') ? [] : ['--no-deprecation', '--no-warnings']),
 ],
 respawn: true,
 mode: 'process',
});

await Manager.spawn()
 .then(() => {
  setInterval(async () => {
   await Manager.broadcastEval('this.status && this.isReady() ? this.reconnect() : 0');
  }, 60000);
 })
 .catch((e: Response) => {
  console.log(
   `[Cluster Manager] Startup Failed. Retry after: ${
    Number(e.headers?.get('retry-after') ?? 0) / 60
   } Minutes`,
  );
  console.error(e);
  process.exit(1);
 });

export default Manager;
