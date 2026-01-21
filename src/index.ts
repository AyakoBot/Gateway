/* eslint-disable no-console */
import { heapStats } from 'bun:jsc';
import { scheduleJob } from 'node-schedule';

console.clear();
console.log('+++++++++++ Welcome to Ayako/Gateway ++++++++++++');
console.log('+                  Arguments:                   +');
console.log('+         --debug --warn --dev --local          +');
console.log('+++++++++++++++++++++++++++++++++++++++++++++++++');

(async () => {
 await import('./BaseClient/Cluster/Manager.js');
 await import('./BaseClient/Cluster/Events.js');
 await import('./BaseClient/Cluster/Stats.js');
})();

setInterval(() => {
 const stats = heapStats();
 const mem = process.memoryUsage();
 console.log(
  `[Memory] RSS: ${Math.round(mem.rss / 1024 / 1024)}MB | Heap: ${Math.round(stats.heapSize / 1024 / 1024)}MB | Objects: ${stats.objectCount}`,
 );
}, 30000);

scheduleJob('*/10 * * * *', async () => {
 console.log(`=> Current Date: ${new Date().toLocaleString()}`);
});
