/* eslint-disable no-console */
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

scheduleJob('*/10 * * * *', async () => {
 console.log(`=> Current Date: ${new Date().toLocaleString()}`);
});
