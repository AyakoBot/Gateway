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
 private readonly flushIntervalMs: number;
 private readonly redis: Redis;
 private readonly execTimeoutMs = 30000;

 constructor(redis: Redis, flushIntervalMs = 10) {
  this.redis = redis;
  this.flushIntervalMs = flushIntervalMs;
 }

 private getBatchSize(): number {
  const depth = this.pending.length;
  if (depth > 50000) return 25000;
  if (depth > 10000) return 10000;
  if (depth > 1000) return 5000;
  return 1000;
 }

 queue(addToPipeline: (pipeline: ChainableCommander) => void): Promise<unknown> {
  return new Promise((resolve, reject) => {
   this.pending.push({ addToPipeline, resolve, reject });
   this.scheduleFlush();
  });
 }

 private scheduleFlush(): void {
  if (this.isProcessing) return;

  const batchSize = this.getBatchSize();

  if (this.pending.length >= batchSize) {
   if (this.flushTimer) {
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
   }
   this.flush();
  } else if (!this.flushTimer) {
   this.flushTimer = setTimeout(() => {
    this.flushTimer = null;
    this.flush();
   }, this.flushIntervalMs);
  }
 }

 private execWithTimeout(pipeline: ChainableCommander): Promise<[error: Error | null, result: unknown][] | null> {
  return Promise.race([
   pipeline.exec(),
   new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Pipeline exec timeout after 30s')), this.execTimeoutMs);
   }),
  ]);
 }

 private async flush(): Promise<void> {
  if (this.isProcessing || this.pending.length === 0) return;

  this.isProcessing = true;
  const startDepth = this.pending.length;
  let totalProcessed = 0;
  let batchNum = 0;

  while (this.pending.length > 0) {
   const batchSize = this.getBatchSize();
   const batch = this.pending.splice(0, batchSize);
   const pipeline = this.redis.pipeline();
   batchNum++;

   try {
    batch.forEach(({ addToPipeline }) => addToPipeline(pipeline));

    if (batch.length > 100) {
     console.log(`[Redis] Executing batch ${batchNum} | Size: ${batch.length} | Pending: ${this.pending.length}`);
    }

    const results = await this.execWithTimeout(pipeline);
    batch.forEach(({ resolve }, i) => resolve(results?.[i]?.[1] ?? null));
    totalProcessed += batch.length;
   } catch (err) {
    console.error('[Redis] Batch failed:', err);
    batch.forEach(({ reject }) => reject(err as Error));
   }
  }

  console.log(
   `[Redis] Flushed ${totalProcessed} ops | Started: ${startDepth} | Remaining: ${this.pending.length}`,
  );

  this.isProcessing = false;

  if (this.pending.length > 0) this.scheduleFlush();
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

const batcher = new PipelineBatcher(cacheDB, 10);

export default cacheDB;

export const cache = {
 auditlogs: new AuditLogCache(cacheDB, batcher),
 automods: new AutomodCache(cacheDB, batcher),
 bans: new BanCache(cacheDB, batcher),
 channels: new ChannelCache(cacheDB, batcher),
 channelStatuses: new ChannelStatusCache(cacheDB),
 commands: new CommandCache(cacheDB, batcher),
 commandPermissions: new CommandPermissionCache(cacheDB, batcher),
 emojis: new EmojiCache(cacheDB, batcher),
 events: new EventCache(cacheDB, batcher),
 guilds: new GuildCache(cacheDB, batcher),
 guildCommands: new GuildCommandCache(cacheDB, batcher),
 integrations: new IntegrationCache(cacheDB, batcher),
 invites: new InviteCache(cacheDB, batcher),
 members: new MemberCache(cacheDB, batcher),
 messages: new MessageCache(cacheDB, batcher),
 pins: new PinCache(cacheDB),
 reactions: new ReactionCache(cacheDB, batcher),
 roles: new RoleCache(cacheDB, batcher),
 soundboards: new SoundboardCache(cacheDB, batcher),
 stages: new StageCache(cacheDB, batcher),
 stickers: new StickerCache(cacheDB, batcher),
 threads: new ThreadCache(cacheDB, batcher),
 threadMembers: new ThreadMemberCache(cacheDB, batcher),
 users: new UserCache(cacheDB, batcher),
 voices: new VoiceCache(cacheDB, batcher),
 webhooks: new WebhookCache(cacheDB, batcher),
 welcomeScreens: new WelcomeScreenCache(cacheDB, batcher),
 onboardings: new OnboardingCache(cacheDB, batcher),
 eventUsers: new EventUserCache(cacheDB, batcher),
};
