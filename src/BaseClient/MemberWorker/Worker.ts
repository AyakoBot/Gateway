/* eslint-disable no-console */
import { Client } from '@discordjs/core';
import { REST } from '@discordjs/rest';
import { WebSocketManager, WebSocketShardEvents } from '@discordjs/ws';
import {
 GatewayDispatchEvents,
 GatewayIntentBits,
 GatewayOpcodes,
 type GatewayDispatchPayload,
} from 'discord-api-types/v10';

import RedisClient, { cache } from '../Bot/Redis.js';

if (!process.env.shardId) throw new Error('No shardId provided in env vars');
if (!process.env.guildId) throw new Error('No guildId provided in env vars');
if (!process.env.token) throw new Error('No token provided in env vars');
if (!process.env.totalShards) throw new Error('No totalShards provided in env vars');

export type Message = {
 type: 'ready' | 'fin';
 guildId: string;
};

const rest = new REST({ api: 'http://127.0.0.1:8080/api' }).setToken(process.env.token);

export const gateway = new WebSocketManager({
 rest,
 intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMembers,
 shardCount: Number(process.env.totalShards),
 shardIds: [Number(process.env.shardId)],
 initialPresence: null,
});

gateway.setToken(process.env.token);
gateway.connect();

export const client = new Client({ rest, gateway });

gateway.on(WebSocketShardEvents.Dispatch, (event, shardId) => {
 ready(event, shardId);
 chunks(event);
});

const ready = (event: GatewayDispatchPayload, shardId: number) => {
 if (event.t !== GatewayDispatchEvents.Ready) return;

 console.log(`[READY] Worker connected to gateway | Shard ${shardId}`);
 process.send?.({ type: 'ready', guildId: process.env.guildId } as Message);

 gateway.send(shardId, {
  op: GatewayOpcodes.RequestGuildMembers,
  d: { guild_id: String(process.env.guildId), presences: false, limit: 0, query: '' },
 });
};

const chunks = async (event: GatewayDispatchPayload) => {
 if (event.t !== GatewayDispatchEvents.GuildMembersChunk) return;

 const data = event.d;

 if (data.guild_id !== process.env.guildId) return;

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

 process.send?.({ type: 'fin', guildId: data.guild_id } as Message);

 setTimeout(() => {
  console.log('[CHUNK] Still alive. Exiting worker for guild', data.guild_id);
  process.exit(0);
 }, 1000);
};
