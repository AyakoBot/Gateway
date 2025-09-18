/* eslint-disable no-console */
import { WebSocketShardEvents } from '@discordjs/ws';
import { GatewayOpcodes } from 'discord-api-types/v10';

import cache from '../../../BaseClient/Bot/CacheHandlers/index.js';
import { gateway } from '../Client.js';

import ready from './ready.js';

gateway.setMaxListeners(
 process.argv.includes('--debug')
  ? Object.keys(WebSocketShardEvents).length
  : Object.keys(WebSocketShardEvents).length - 2,
);

gateway.on(WebSocketShardEvents.Ready, (data, shardId) => ready(data, shardId));

gateway.on(WebSocketShardEvents.Hello, (shardId) =>
 console.log(`[Hello from Discord | Shard ${shardId}]`),
);

gateway.on(WebSocketShardEvents.Resumed, (shardId) =>
 console.log(`[Connection Resumed | Shard ${shardId}]`),
);

gateway.on(WebSocketShardEvents.SocketError, (error, shardId) =>
 console.log(`[Socket Error | Shard ${shardId}]`, JSON.stringify(error)),
);

gateway.on(WebSocketShardEvents.Error, (error, shardId) =>
 console.log(`[Error | Shard ${shardId}]`, JSON.stringify(error)),
);

gateway.on(WebSocketShardEvents.Closed, (code, shardId) =>
 console.log(`[Connection Closed | Shard ${shardId}] Code: ${code}`),
);

gateway.on(WebSocketShardEvents.Dispatch, (data, shardId) => {
 if (data.op !== GatewayOpcodes.Dispatch) {
  console.log(`[Non-Dispatch Payload | Shard ${shardId}]`, JSON.stringify(data));
  return;
 }

 cache(data, shardId);
});

if (process.argv.includes('--debug')) {
 gateway.on(WebSocketShardEvents.Debug, (info, shardId) =>
  console.log(`[Debug | Shard ${shardId}]`, info),
 );
 gateway.on(WebSocketShardEvents.HeartbeatComplete, (info, shardId) =>
  console.log(`[Heartbeat Completed | Shard ${shardId}] Latency: ${info.latency}ms`),
 );
}
