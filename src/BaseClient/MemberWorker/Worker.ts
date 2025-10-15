/* eslint-disable no-console */
import 'dotenv/config';
import { parentPort, workerData as rawWorkerData } from 'worker_threads';

import { Client } from '@discordjs/core';
import { REST } from '@discordjs/rest';
import { WebSocketManager, WebSocketShardEvents } from '@discordjs/ws';
import {
 GatewayDispatchEvents,
 GatewayIntentBits,
 type GatewayDispatchPayload,
} from 'discord-api-types/v10';
import { getInfo } from 'discord-hybrid-sharding';

import RedisClient, { cache } from '../Bot/Redis.js';

export type PassObject = {
 guildId: string;
 shardId: number;
};

export type Message = {
 type: 'ready' | 'fin';
 guildId: string;
};

const workerData = rawWorkerData as PassObject;

const cleanedToken = (
 (process.argv.includes('--dev') ? process.env.DevToken : process.env.Token) ?? ''
).replace('Bot ', '');

const rest = new REST({ api: 'http://127.0.0.1:8080/api' }).setToken(cleanedToken);

export const gateway = new WebSocketManager({
 rest,
 intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMembers,
 shardCount: getInfo().TOTAL_SHARDS,
 shardIds: [workerData.shardId],
 initialPresence: null,
});

gateway.setToken(cleanedToken);
gateway.connect();

export const client = new Client({ rest, gateway });

gateway.on(WebSocketShardEvents.Dispatch, (event, shardId) => {
 ready(event, shardId);
 chunks(event);
});

const ready = (event: GatewayDispatchPayload, shardId: number) => {
 if (event.t !== GatewayDispatchEvents.Ready) return;

 console.log(`[READY] Worker connected to gateway | Shard ${shardId}`);
 parentPort?.postMessage({ type: 'ready', guildId: workerData.guildId } as Message);
};

const chunks = async (event: GatewayDispatchPayload) => {
 if (event.t !== GatewayDispatchEvents.GuildMembersChunk) return;

 const data = event.d;

 if (data.guild_id !== workerData.guildId) return;

 if (data.chunk_index === 0) {
  console.log('[CHUNK] Receiving member chunks for', data.guild_id, data.chunk_count);

  const keystoreKey = cache.members.keystore(data.guild_id);
  const keys = await RedisClient.hkeys(keystoreKey);
  if (keys.length > 0) {
   const pipeline = RedisClient.pipeline();
   keys.forEach((key) => pipeline.del(key));
   pipeline.del(keystoreKey);
   await pipeline.exec();
  }
 }

 await cache.members.setMany(data.members, data.guild_id);

 if (data.chunk_index !== data.chunk_count - 1) return;

 console.log('[CHUNK] Finished receiving member chunks for', data.guild_id);

 parentPort?.postMessage({ type: 'fin', guildId: data.guild_id } as Message);
 process.exit();
};
