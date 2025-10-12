/* eslint-disable no-console */
import 'dotenv/config';
import './BaseClient/Bot/Client.js';

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
