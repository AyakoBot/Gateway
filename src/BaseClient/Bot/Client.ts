import { Client } from '@discordjs/core';
import { REST } from '@discordjs/rest';
import { WebSocketManager } from '@discordjs/ws';
import { ActivityType, PresenceUpdateStatus, type APIUser } from 'discord-api-types/v10';
import { ClusterClient, getInfo } from 'discord-hybrid-sharding';

import { currentBot, defaultIntents } from '../Cluster/bots.js';

const cleanedToken = (currentBot?.token ?? '').replace('Bot ', '');

const rest = new REST({
 api: `http://${process.argv.includes('--dev') ? 'localhost' : 'nirn'}:8080/api`,
}).setToken(cleanedToken);

export const gateway = new WebSocketManager({
 rest,
 intents: currentBot?.intents ?? defaultIntents,
 shardCount: getInfo().TOTAL_SHARDS,
 shardIds: getInfo().SHARD_LIST,
 initialPresence: {
  status: PresenceUpdateStatus.Idle,
  afk: true,
  since: Date.now(),
  activities: [
   {
    state: 'Starting up...',
    name: 'Starting up...',
    type: ActivityType.Custom,
   },
  ],
 },
});

gateway.setToken(cleanedToken);
gateway.connect();

export const client = new Client({ rest, gateway });
export const { api } = client;
export const cluster = new ClusterClient(client);
export const cache: {
 approxGuilds: number;
 members: Map<string, number>;
 emojis: Map<string, number>;
 roles: Map<string, number>;
 stickers: Map<string, number>;
 sounds: Map<string, number>;
 user: APIUser | null;
} = {
 approxGuilds: await api.applications.getCurrent().then((app) => app.approximate_guild_count ?? 0),
 members: new Map(),
 emojis: new Map(),
 roles: new Map(),
 stickers: new Map(),
 sounds: new Map(),
 user: null,
};
