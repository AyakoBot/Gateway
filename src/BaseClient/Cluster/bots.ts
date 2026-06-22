import { GatewayIntentBits } from 'discord-api-types/v10';
import 'dotenv/config';

const isDev = process.argv.includes('--dev');

export const baseKey = 'MAIN_TOKEN';

export const defaultIntents =
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
 GatewayIntentBits.GuildMessageTyping;

export interface BotConfig {
 key: string;
 token: string | undefined;
 intents: number;
 priority: number;
}

const definitions: Array<{ key: string; token: string | undefined; intents?: number }> = [
 { key: baseKey, token: isDev ? process.env.DevToken : process.env.Token },
 {
  key: 'TICKET_TOKEN',
  token: process.env.TICKET_TOKEN,
  intents:
   GatewayIntentBits.Guilds |
   GatewayIntentBits.GuildMessages |
   GatewayIntentBits.DirectMessages |
   GatewayIntentBits.MessageContent,
 },
 // { key: 'AFK_TOKEN', token: process.env.AFK_TOKEN },
];

const getPriority = (index: number, intents: number): number => {
 if (index === 0) return 0;

 const hasMembers = (intents & GatewayIntentBits.GuildMembers) !== 0;
 const hasContent = (intents & GatewayIntentBits.MessageContent) !== 0;
 if (!hasMembers && !hasContent) return 4;
 if (!hasMembers && hasContent) return 3;
 if (hasMembers && !hasContent) return 2;
 return 1;
};

export const bots: BotConfig[] = definitions.map((d, i) => ({
 key: d.key,
 token: d.token,
 intents: d.intents ?? defaultIntents,
 priority: getPriority(i, d.intents ?? defaultIntents),
}));

export const activeBots: BotConfig[] = bots.filter((b) => !!b.token);

export const byKey = (key: string): BotConfig | undefined => bots.find((b) => b.key === key);

export const priorityOf = (key: string): number => byKey(key)?.priority ?? Number.MAX_SAFE_INTEGER;

export const currentKey: string =
 process.argv.find((a) => a.startsWith('--key='))?.slice('--key='.length) ?? baseKey;

export const currentBot: BotConfig | undefined = byKey(currentKey);

export const dedupeEnabled: boolean = activeBots.length > 1;
