/* eslint-disable no-console */
import 'dotenv/config';
import 'longjohn';
import sms from 'source-map-support';

import './BaseClient/Bot/Client.js';

sms.install({
 handleUncaughtExceptions: process.argv.includes('--debug'),
 environment: 'node',
 emptyCacheBetweenOperations: process.argv.includes('--debug'),
});

if (process.argv.includes('--debug')) console.log('[Debug] Debug mode enabled');
if (process.argv.includes('--debug-db')) console.log('[Debug] Debug mode for database enabled');
if (process.argv.includes('--warn')) console.log('[Debug] Warn mode enabled');
if (process.argv.includes('--silent')) console.log('[Debug] Silent mode enabled');

(async () => {
 [
  './BaseClient/Bot/Events/Gateway.js',
  './BaseClient/Bot/Events/Process.js',
  './BaseClient/Bot/Events/Rest.js',
 ].forEach((fileName) => import(fileName));
})();
