/* eslint-disable no-console */
import { WebSocketShardEvents } from '@discordjs/ws';
import type { WebSocketManager } from '@discordjs/ws';
import { GatewayOpcodes } from 'discord-api-types/v10';

import cache from '../../../BaseClient/Bot/CacheHandlers/index.js';
import { gateway } from '../Client.js';
import Metrics from '../Metrics.js';

// Type augmentation for internal WebSocketManager methods
interface WebSocketManagerInternal extends WebSocketManager {
 get(shardId: number): { setMaxListeners?: (n: number) => void } | undefined;
}

gateway.setMaxListeners(Object.keys(WebSocketShardEvents).length);

gateway.on(WebSocketShardEvents.Hello, (shardId) => {
 const shard = (gateway as WebSocketManagerInternal).get(shardId);
 if (shard?.setMaxListeners) shard.setMaxListeners(20);

 console.log(`[Hello from Discord | Shard ${shardId}]`);
});

gateway.on(WebSocketShardEvents.Resumed, (shardId) =>
 console.log(`[Connection Resumed | Shard ${shardId}]`),
);

gateway.on(WebSocketShardEvents.SocketError, (error, shardId) => {
 console.log(`[Socket Error | Shard ${shardId}]`, JSON.stringify(error));
});

gateway.on(WebSocketShardEvents.Error, (error, shardId) => {
 console.log(`[Error | Shard ${shardId}]`, JSON.stringify(error));
});

gateway.on(WebSocketShardEvents.Closed, (code, shardId) => {
 console.log(`[Connection Closed | Shard ${shardId}] Code: ${code}`);
});

gateway.on(WebSocketShardEvents.Dispatch, (data, shardId) => {
 Metrics.shardEventsReceived(data.op, shardId);

 if (data.op !== GatewayOpcodes.Dispatch) {
  console.log(`[Non-Dispatch Payload | Shard ${shardId}]`, JSON.stringify(data));
  return;
 }

 Metrics.dispatchEventsReceived(data.t, shardId);
 cache(data, shardId);
});

gateway.on(WebSocketShardEvents.Debug, (info, shardId) => {
 if (process.argv.includes('--debug')) console.log(`[Debug | Shard ${shardId}]`, info);
});

gateway.on(WebSocketShardEvents.HeartbeatComplete, (info, shardId) => {
 Metrics.shardLatency(info.latency, shardId);

 if (process.argv.includes('--debug')) {
  console.log(`[Heartbeat Completed | Shard ${shardId}] Latency: ${info.latency}ms`);
 }
});
