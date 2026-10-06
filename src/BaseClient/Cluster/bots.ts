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

export enum DedupeLens {
 Members = 'members',
 Content = 'content',
}

export interface BotConfig {
 key: string;
 token: string | undefined;
 intents: number;
 priority: Record<DedupeLens, number>;
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
  guildLogThread: '1556693755300544512',
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

const lensIntents: Record<DedupeLens, [GatewayIntentBits, GatewayIntentBits]> = {
 [DedupeLens.Members]: [GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent],
 [DedupeLens.Content]: [GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
};

const getPriority = (index: number, intents: number, lens: DedupeLens): number => {
 if (index === 0) return 0;

 const [lead, second] = lensIntents[lens];
 const hasLead = (intents & lead) !== 0;
 const hasSecond = (intents & second) !== 0;
 if (!hasLead && !hasSecond) return 4;
 if (!hasLead && hasSecond) return 3;
 if (hasLead && !hasSecond) return 2;
 return 1;
};

export const bots: BotConfig[] = definitions.map((d, i) => {
 const intents = d.intents ?? defaultIntents;

 return {
  key: d.key,
  token: d.token,
  intents,
  priority: {
   [DedupeLens.Members]: getPriority(i, intents, DedupeLens.Members),
   [DedupeLens.Content]: getPriority(i, intents, DedupeLens.Content),
  },
  guildLogThread: d.guildLogThread,
 };
});

export const activeBots: BotConfig[] = bots.filter((b) => !!b.token);

export const byKey = (key: string): BotConfig | undefined => bots.find((b) => b.key === key);

export const priorityOf = (key: string, lens: DedupeLens): number =>
 byKey(key)?.priority[lens] ?? Number.MAX_SAFE_INTEGER;

export const currentKey: string =
 process.argv.find((a) => a.startsWith('--key='))?.slice('--key='.length) ?? baseKey;

export const currentBot: BotConfig | undefined = byKey(currentKey);

export const dedupeEnabled: boolean = activeBots.length > 1;
