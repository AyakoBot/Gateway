/* eslint-disable no-console */
import { scheduleJob } from 'node-schedule';

console.clear();
console.log('+++++++++++ Welcome to Ayako/Gateway ++++++++++++');
console.log('+                  Arguments:                   +');
console.log('+             --debug --warn --dev              +');
console.log('+++++++++++++++++++++++++++++++++++++++++++++++++');

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
