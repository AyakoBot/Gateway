import Redis, { type ChainableCommander } from 'ioredis';

import AuditLogCache from './CacheClasses/auditlog.js';
import AutomodCache from './CacheClasses/automod.js';
import BanCache from './CacheClasses/ban.js';
import ChannelCache from './CacheClasses/channel.js';
import ChannelStatusCache from './CacheClasses/channelStatus.js';
import CommandCache from './CacheClasses/command.js';
import CommandPermissionCache from './CacheClasses/commandPermission.js';
import EmojiCache from './CacheClasses/emoji.js';
import EventCache from './CacheClasses/event.js';
import EventUserCache from './CacheClasses/eventUser.js';
import GuildCache from './CacheClasses/guild.js';
import GuildCommandCache from './CacheClasses/guildCommand.js';
import IntegrationCache from './CacheClasses/integration.js';
import InviteCache from './CacheClasses/invite.js';
import MemberCache from './CacheClasses/member.js';
import MessageCache from './CacheClasses/message.js';
import OnboardingCache from './CacheClasses/onboarding.js';
import PinCache from './CacheClasses/pin.js';
import ReactionCache from './CacheClasses/reaction.js';
import RoleCache from './CacheClasses/role.js';
import SoundboardCache from './CacheClasses/soundboard.js';
import StageCache from './CacheClasses/stage.js';
import StickerCache from './CacheClasses/sticker.js';
import ThreadCache from './CacheClasses/thread.js';
import ThreadMemberCache from './CacheClasses/threadMember.js';
import UserCache from './CacheClasses/user.js';
import VoiceCache from './CacheClasses/voice.js';
import WebhookCache from './CacheClasses/webhook.js';
import WelcomeScreenCache from './CacheClasses/welcomeScreen.js';

export const prefix = 'cache';
const cacheDBnum = process.argv.includes('--dev') ? process.env.devCacheDB : process.env.cacheDB;

type QueuedOperation = {
 addToPipeline: (pipeline: ChainableCommander) => void;
 resolve: (result: unknown) => void;
 reject: (err: Error) => void;
};

export class PipelineBatcher {
 private pending: QueuedOperation[] = [];
 private isProcessing = false;
 private flushTimer: ReturnType<typeof setTimeout> | null = null;
 private readonly batchSize: number;
 private readonly flushIntervalMs: number;
 private readonly redis: Redis;

 constructor(redis: Redis, batchSize = 500, flushIntervalMs = 10) {
  this.redis = redis;
  this.batchSize = batchSize;
  this.flushIntervalMs = flushIntervalMs;
 }

 queue(addToPipeline: (pipeline: ChainableCommander) => void): Promise<unknown> {
  return new Promise((resolve, reject) => {
   this.pending.push({ addToPipeline, resolve, reject });

   if (this.pending.length >= this.batchSize) {
    this.flush();
   } else if (!this.flushTimer && !this.isProcessing) {
    this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs);
   }
  });
 }

 private async flush(): Promise<void> {
  if (this.flushTimer) {
   clearTimeout(this.flushTimer);
   this.flushTimer = null;
  }

  if (this.isProcessing || this.pending.length === 0) return;

  this.isProcessing = true;
  const batch = this.pending.splice(0, this.batchSize);
  const pipeline = this.redis.pipeline();

  batch.forEach(({ addToPipeline }) => addToPipeline(pipeline));

  try {
   const results = await pipeline.exec();
   batch.forEach(({ resolve }, i) => resolve(results?.[i]?.[1] ?? null));
  } catch (err) {
   batch.forEach(({ reject }) => reject(err as Error));
  }

  this.isProcessing = false;

  if (this.pending.length > 0) this.flush();
 }
}

if (!cacheDBnum || isNaN(Number(cacheDBnum))) {
 throw new Error('No cache DB number provided in env vars');
}

export const cacheDB = new Redis({
 host: process.argv.includes('--dev') ? 'localhost' : 'redis',
 db: Number(cacheDBnum),
});
await cacheDB.config('SET', 'notify-keyspace-events', 'Ex');

export const batcher = new PipelineBatcher(cacheDB, 500, 10);

export default cacheDB;

export const cache = {
 auditlogs: new AuditLogCache(cacheDB),
 automods: new AutomodCache(cacheDB),
 bans: new BanCache(cacheDB),
 channels: new ChannelCache(cacheDB),
 channelStatuses: new ChannelStatusCache(cacheDB),
 commands: new CommandCache(cacheDB),
 commandPermissions: new CommandPermissionCache(cacheDB),
 emojis: new EmojiCache(cacheDB),
 events: new EventCache(cacheDB),
 guilds: new GuildCache(cacheDB),
 guildCommands: new GuildCommandCache(cacheDB),
 integrations: new IntegrationCache(cacheDB),
 invites: new InviteCache(cacheDB),
 members: new MemberCache(cacheDB),
 messages: new MessageCache(cacheDB),
 pins: new PinCache(cacheDB),
 reactions: new ReactionCache(cacheDB),
 roles: new RoleCache(cacheDB),
 soundboards: new SoundboardCache(cacheDB),
 stages: new StageCache(cacheDB),
 stickers: new StickerCache(cacheDB),
 threads: new ThreadCache(cacheDB),
 threadMembers: new ThreadMemberCache(cacheDB),
 users: new UserCache(cacheDB),
 voices: new VoiceCache(cacheDB),
 webhooks: new WebhookCache(cacheDB),
 welcomeScreens: new WelcomeScreenCache(cacheDB),
 onboardings: new OnboardingCache(cacheDB),
 eventUsers: new EventUserCache(cacheDB),
};
