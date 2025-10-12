/* eslint-disable no-console */

import { RESTEvents } from '@discordjs/rest';

import { client } from '../Client.js';

client.rest.setMaxListeners(
 process.argv.includes('--debug')
  ? Object.keys(RESTEvents).length
  : Object.keys(RESTEvents).length - 1,
);

client.rest.on(RESTEvents.HandlerSweep, (handlers) =>
 console.log('[Handler Sweep]', handlers.keys()),
);

client.rest.on(RESTEvents.HashSweep, (hash) => console.log('[Hash Sweep]', hash.keys()));

client.rest.on(RESTEvents.InvalidRequestWarning, (info) =>
 console.log(`[Invalid Request] Count: ${[info.count]} | Remaining time: ${info.remainingTime}`),
);

client.rest.on(RESTEvents.RateLimited, (info) =>
 console.log(
  `[Ratelimit] ${info.method} ${info.url.replace(
   'https://discord.com/api/v10/',
   '',
  )} ${info.timeToReset}ms`,
 ),
);

client.rest.on(RESTEvents.Response, (request, response) => {
 if (String(response.status).startsWith('2')) return;

 console.log(
  `[Request] ${response.status} | ${response.statusText} - ${request.method} ${request.path}`,
 );
});

if (process.argv.includes('--debug')) {
 client.rest.on(RESTEvents.Debug, (...args) => console.log('[Debug]', args));
}
