/* eslint-disable no-console */
import { heapStats } from 'bun:jsc';
import 'dotenv/config';
import './BaseClient/Bot/Client.js';
import { getInfo } from 'discord-hybrid-sharding';

import { priorityQueue } from './Util/PriorityQueue/index.js';

if (process.argv.includes('--debug')) console.log('[Debug] Debug mode enabled');
if (process.argv.includes('--debug-db')) console.log('[Debug] Debug mode for database enabled');
if (process.argv.includes('--warn')) console.log('[Debug] Warn mode enabled');
if (process.argv.includes('--silent')) console.log('[Debug] Silent mode enabled');

const clusterId = getInfo().CLUSTER;

setInterval(() => {
 const stats = heapStats();
 const mem = process.memoryUsage();
 const queueStats = priorityQueue.getStats();
 console.log(
  `[Shard ${clusterId}] RSS: ${Math.round(mem.rss / 1024 / 1024)}MB | Heap: ${Math.round(stats.heapSize / 1024 / 1024)}MB | Objects: ${stats.objectCount} | GatewayQ: ${queueStats.gatewayQueue} | RestQ: ${queueStats.restQueue} (${queueStats.activeRestRequests} active)`,
 );
}, 30000);

(async () => {
 await Promise.all([
  import('./BaseClient/Bot/Events/Gateway.js'),
  import('./BaseClient/Bot/Events/Process.js'),
  import('./BaseClient/Bot/Events/Rest.js'),
 ]);

 priorityQueue.start();
})();
