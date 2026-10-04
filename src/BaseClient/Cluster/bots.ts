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
 GatewayIntentBits.GuildMessageTyping |
 GatewayIntentBits.GuildMessagePolls;

export interface BotConfig {
 key: string;
 token: string | undefined;
 intents: number;
 priority: number;
 guildLogThread: string | undefined;
}

const definitions: Array<{
 key: string;
 token: string | undefined;
 intents?: number;
 guildLogThread?: string;
}> = [
 { key: baseKey, token: isDev ? process.env.DevToken : process.env.Token },
 {
  key: 'TICKET_TOKEN',
  token: process.env.TICKET_TOKEN,
  guildLogThread: '1554605476107395242',
  intents:
   GatewayIntentBits.Guilds |
   GatewayIntentBits.GuildMessages |
   GatewayIntentBits.DirectMessages |
   GatewayIntentBits.MessageContent,
 },
 {
  key: 'INFO_TOKEN',
  token: process.env.INFO_TOKEN,
  guildLogThread: '1554605436253118564',
  intents: GatewayIntentBits.Guilds,
 },
 {
  key: 'AFK_TOKEN',
  token: process.env.AFK_TOKEN,
  intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages,
 },
 {
  key: 'RP_TOKEN',
  token: process.env.RP_TOKEN,
  intents:
   GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages | GatewayIntentBits.MessageContent,
 },
 {
  key: 'WELCOME_TOKEN',
  token: process.env.WELCOME_TOKEN,
  guildLogThread: '1554605520453771314',
  intents:
   GatewayIntentBits.Guilds |
   GatewayIntentBits.GuildMembers |
   GatewayIntentBits.GuildModeration,
 },
 {
  key: 'ECONOMY_TOKEN',
  token: process.env.ECONOMY_TOKEN,
  guildLogThread: '1554605692977938512',
  intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages,
 },
 {
  key: 'CUSTOM_ROLES_TOKEN',
  token: process.env.CUSTOM_ROLES_TOKEN,
  guildLogThread: '1554605652612222996',
  intents:
   GatewayIntentBits.Guilds |
   GatewayIntentBits.GuildMembers |
   GatewayIntentBits.GuildMessages |
   GatewayIntentBits.GuildMessageReactions |
   GatewayIntentBits.GuildVoiceStates,
 },
 {
  key: 'CONFESSIONS_TOKEN',
  token: process.env.CONFESSIONS_TOKEN,
  guildLogThread: '1554605606768480307',
  intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages,
 },
 {
  key: 'REMINDERS_TOKEN',
  token: process.env.REMINDERS_TOKEN,
  guildLogThread: '1556106975245373460',
  intents: GatewayIntentBits.Guilds,
 },
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
 guildLogThread: d.guildLogThread,
}));

export const activeBots: BotConfig[] = bots.filter((b) => !!b.token);

export const byKey = (key: string): BotConfig | undefined => bots.find((b) => b.key === key);

export const priorityOf = (key: string): number => byKey(key)?.priority ?? Number.MAX_SAFE_INTEGER;

export const currentKey: string =
 process.argv.find((a) => a.startsWith('--key='))?.slice('--key='.length) ?? baseKey;

export const currentBot: BotConfig | undefined = byKey(currentKey);

export const dedupeEnabled: boolean = activeBots.length > 1;
