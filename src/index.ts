/* eslint-disable no-console */
import 'longjohn';
import { scheduleJob } from 'node-schedule';
import sms from 'source-map-support';

console.clear();
console.log('+++++++++++ Welcome to Ayako/Gateway ++++++++++++');
console.log('+      Restart all Clusters with "restart"      +');
console.log('+                  Arguments:                   +');
console.log('+             --debug --warn --dev              +');
console.log('+++++++++++++++++++++++++++++++++++++++++++++++++');

sms.install({
 handleUncaughtExceptions: process.argv.includes('--debug'),
 environment: 'node',
 emptyCacheBetweenOperations: process.argv.includes('--debug'),
});

(async () => {
 [
  './BaseClient/Cluster/Manager.js',
  './BaseClient/Cluster/Events.js',
  './BaseClient/Cluster/Stats.js',
 ].forEach((fileName) => import(fileName));
})();

scheduleJob('*/10 * * * *', async () => {
 console.log(`=> Current Date: ${new Date().toLocaleString()}`);
});
