import { Client } from '@discordjs/core';
import { REST } from '@discordjs/rest';
import { WebSocketManager } from '@discordjs/ws';
import {
 ActivityType,
 GatewayIntentBits,
 PresenceUpdateStatus,
 type APIUser,
} from 'discord-api-types/v10';
import { ClusterClient, getInfo } from 'discord-hybrid-sharding';

const cleanedToken = (
 (process.argv.includes('--dev') ? process.env.DevToken : process.env.Token) ?? ''
).replace('Bot ', '');

const rest = new REST({
 api: `http://${process.argv.includes('--dev') ? 'localhost' : 'nirn'}:8080/api`,
}).setToken(cleanedToken);

export const gateway = new WebSocketManager({
 rest,
 intents:
  GatewayIntentBits.Guilds |
  GatewayIntentBits.GuildMembers |
  GatewayIntentBits.GuildModeration |
  GatewayIntentBits.GuildExpressions |
  GatewayIntentBits.GuildIntegrations |
  GatewayIntentBits.GuildWebhooks |
  GatewayIntentBits.GuildInvites |
  GatewayIntentBits.GuildVoiceStates |
  GatewayIntentBits.GuildMessages |
  GatewayIntentBits.GuildMessageReactions |
  GatewayIntentBits.DirectMessages |
  GatewayIntentBits.DirectMessageReactions |
  GatewayIntentBits.MessageContent |
  GatewayIntentBits.GuildScheduledEvents |
  GatewayIntentBits.AutoModerationConfiguration |
  GatewayIntentBits.AutoModerationExecution |
  GatewayIntentBits.GuildMessageTyping,
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
 guilds: number;
 members: Map<string, number>;
 emojis: Map<string, number>;
 roles: Map<string, number>;
 stickers: Map<string, number>;
 sounds: Map<string, number>;
 user: APIUser | null;
 requestingGuild: string | null;
 requestGuildQueue: Set<string>;
 requestingPins: string | null;
 requestPinsQueue: Set<string>;
 requestPinsGuildMap: Map<string, string>;
 requestPinsPaused: boolean;
} = {
 guilds: 0,
 members: new Map(),
 emojis: new Map(),
 roles: new Map(),
 stickers: new Map(),
 sounds: new Map(),
 user: null,
 requestingGuild: null,
 requestGuildQueue: new Set(),
 requestingPins: null,
 requestPinsQueue: new Set(),
 requestPinsGuildMap: new Map(),
 requestPinsPaused: false,
};
