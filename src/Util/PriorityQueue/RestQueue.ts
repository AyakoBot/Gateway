/**
 * REST Queue - Handles all Discord REST API calls with rate limiting
 *
 * - Max 5 concurrent requests (configurable)
 * - Per-endpoint rate limit tracking
 * - Re-queues on 429 with retry_after delay
 * - Priority by member count (larger guilds first), then guild > channel
 */
import { getChannelPerms, getGuildPerms } from '@ayako/utility';
import { GuildFeature, PermissionFlagsBits } from 'discord-api-types/v10';

import redis from '../../BaseClient/Bot/Cache.js';
import { api, cache as clientCache } from '../../BaseClient/Bot/Client.js';
import requestEventSubscribers from '../requestEventSubscribers.js';
import requestVoiceChannelStatuses from '../requestVoiceChannelStatuses.js';

import { BinaryHeap } from './BinaryHeap.js';
import {
 CONFIG,
 type ChannelTaskName,
 type GuildTaskName,
 type RateLimitState,
 type RestQueueItem,
} from './types.js';

/**
 * Priority comparator for REST queue items
 * Higher member count = higher priority
 * Equal member count: guild > channel
 * Equal type: FIFO by addedAt
 */
const restComparator = (a: RestQueueItem, b: RestQueueItem): number => {
 if (a.memberCount !== b.memberCount) return b.memberCount - a.memberCount;
 if (a.type !== b.type) return a.type === 'guild' ? -1 : 1;
 return a.addedAt - b.addedAt;
};

class RestQueue {
 private queue = new BinaryHeap<RestQueueItem>(restComparator);
 private rateLimits = new Map<string, RateLimitState>();
 private activeRequests = 0;
 private processingInterval: ReturnType<typeof setInterval> | null = null;
 private isProcessing = false;

 /**
  * Get the number of items in the queue
  */
 get size(): number {
  return this.queue.size;
 }

 /**
  * Get the number of active requests
  */
 get active(): number {
  return this.activeRequests;
 }

 /**
  * Start the queue processing interval
  */
 start(): void {
  if (this.processingInterval) return;
  this.processingInterval = setInterval(() => {
   this.process().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[RestQueue] Error processing queue:', err);
   });
  }, CONFIG.REST_INTERVAL);
  // eslint-disable-next-line no-console
  console.log('[RestQueue] Started');
 }

 /**
  * Stop the queue processing interval
  */
 stop(): void {
  if (this.processingInterval) {
   clearInterval(this.processingInterval);
   this.processingInterval = null;
   // eslint-disable-next-line no-console
   console.log('[RestQueue] Stopped');
  }
 }

 /**
  * Enqueue all guild tasks for first guild interaction
  */
 enqueueGuildTasks(guildId: string, memberCount: number): void {
  const now = Date.now();
  const guildTasks: GuildTaskName[] = [
   'vcStatus',
   'autoModRules',
   'commands',
   'commandPermissions',
   'welcomeScreen',
   'onboarding',
   'scheduledEvents',
   'webhooks',
   'integrations',
   'invites',
  ];

  for (const taskName of guildTasks) {
   this.queue.push({
    type: 'guild',
    id: guildId,
    guildId,
    memberCount,
    taskName,
    endpoint: `guilds/${guildId}/${taskName}`,
    addedAt: now,
   });
  }
 }

 /**
  * Enqueue a single guild task (for subsequent updates, not first interaction)
  */
 enqueueGuildTask(guildId: string, memberCount: number, taskName: GuildTaskName): void {
  if (
   this.queue.has(
    (item) => item.type === 'guild' && item.guildId === guildId && item.taskName === taskName,
   )
  ) {
   return;
  }

  this.queue.push({
   type: 'guild',
   id: guildId,
   guildId,
   memberCount,
   taskName,
   endpoint: `guilds/${guildId}/${taskName}`,
   addedAt: Date.now(),
  });
 }

 /**
  * Enqueue a channel task (e.g., pins) for first channel interaction
  */
 enqueueChannelTask(
  channelId: string,
  guildId: string,
  memberCount: number,
  taskName: ChannelTaskName,
 ): void {
  if (
   this.queue.has(
    (item) => item.type === 'channel' && item.id === channelId && item.taskName === taskName,
   )
  ) {
   return;
  }

  this.queue.push({
   type: 'channel',
   id: channelId,
   guildId,
   memberCount,
   taskName,
   endpoint: `channels/${channelId}/${taskName}`,
   addedAt: Date.now(),
  });
 }

 /**
  * Process items from the queue
  */
 private async process(): Promise<void> {
  if (this.isProcessing) return;
  if (this.activeRequests >= CONFIG.REST_MAX_CONCURRENT) return;
  if (this.queue.isEmpty) return;

  const redisQueueSize = redis.cacheDb.getQueueSize();
  if (redisQueueSize > CONFIG.REDIS_QUEUE_THRESHOLD) {
   // eslint-disable-next-line no-console
   console.log(
    `[RestQueue] Backpressure: Redis queue ${redisQueueSize} > threshold ${CONFIG.REDIS_QUEUE_THRESHOLD}, pausing`,
   );
   return;
  }

  this.isProcessing = true;

  try {
   this.cleanupRateLimits();

   while (this.activeRequests < CONFIG.REST_MAX_CONCURRENT && !this.queue.isEmpty) {
    const currentQueueSize = redis.cacheDb.getQueueSize();
    if (currentQueueSize > CONFIG.REDIS_QUEUE_THRESHOLD) {
     // eslint-disable-next-line no-console
     console.log(`[RestQueue] Backpressure mid-loop: Redis queue ${currentQueueSize}, stopping`);
     break;
    }

    const item = this.findNextUnblockedItem();
    if (!item) break;

    this.executeTask(item).catch((err) => {
     // eslint-disable-next-line no-console
     console.error(`[RestQueue] Task ${item.taskName} failed:`, err);
    });
   }
  } finally {
   this.isProcessing = false;
  }
 }

 /**
  * Find the next item that isn't rate limited
  */
 private findNextUnblockedItem(): RestQueueItem | undefined {
  const items = this.queue.toArray();

  for (let i = 0; i < items.length; i++) {
   const item = items[i];
   const rateLimit = this.rateLimits.get(item.endpoint);

   if (!rateLimit || !rateLimit.paused || Date.now() >= rateLimit.resetAt) {
    this.queue.remove((it) => it === item);
    return item;
   }
  }

  return undefined;
 }

 /**
  * Clean up expired rate limits
  */
 private cleanupRateLimits(): void {
  const now = Date.now();
  for (const [endpoint, state] of this.rateLimits) {
   if (now >= state.resetAt) {
    this.rateLimits.delete(endpoint);
   }
  }
 }

 /**
  * Handle rate limit (429) response
  */
 private onRateLimit(item: RestQueueItem, retryAfter: number): void {
  this.rateLimits.set(item.endpoint, {
   endpoint: item.endpoint,
   resetAt: Date.now() + retryAfter,
   paused: true,
  });

  this.queue.push(item);

  // eslint-disable-next-line no-console
  console.log(
   `[RestQueue] Rate limited on ${item.endpoint}, retry after ${retryAfter}ms | Queue: ${this.queue.size}`,
  );
 }

 /**
  * Execute a task
  */
 private async executeTask(item: RestQueueItem): Promise<void> {
  this.activeRequests++;

  try {
   if (item.type === 'guild') {
    await this.executeGuildTask(item);
   } else {
    await this.executeChannelTask(item);
   }
  } catch (error: unknown) {
   if (this.isRateLimitError(error)) {
    const retryAfter = this.getRateLimitRetryAfter(error);
    this.onRateLimit(item, retryAfter);
   }
  } finally {
   this.activeRequests--;
  }
 }

 /**
  * Execute a guild task
  */
 private async executeGuildTask(item: RestQueueItem): Promise<void> {
  const { guildId } = item;

  switch (item.taskName) {
   case 'vcStatus':
    await requestVoiceChannelStatuses(guildId);
    break;

   case 'autoModRules':
    await this.taskAutoModRules(guildId);
    break;

   case 'commands':
    await this.taskCommands(guildId);
    break;

   case 'commandPermissions':
    await this.taskCommandPermissions(guildId);
    break;

   case 'welcomeScreen':
    await this.taskWelcomeScreen(guildId);
    break;

   case 'onboarding':
    await this.taskOnboarding(guildId);
    break;

   case 'scheduledEvents':
    await this.taskScheduledEvents(guildId);
    break;

   case 'webhooks':
    await this.taskWebhooks(guildId);
    break;

   case 'integrations':
    await this.taskIntegrations(guildId);
    break;

   case 'invites':
    await this.taskInvites(guildId);
    break;

   default:
    break;
  }
 }

 /**
  * Execute a channel task
  */
 private async executeChannelTask(item: RestQueueItem): Promise<void> {
  if (item.taskName === 'pins') {
   await this.taskPins(item.id, item.guildId);
  }
 }

 //#region Guild Tasks

 private async taskAutoModRules(guildId: string): Promise<void> {
  const perms = await getGuildPerms.call(redis, guildId, clientCache.user?.id || '0');
  if ((perms.response & PermissionFlagsBits.ManageGuild) !== PermissionFlagsBits.ManageGuild) {
   return;
  }

  const keystoreKey = redis.automods.keystore(guildId);
  const keys = await redis.cacheDb.hkeys(keystoreKey);
  if (keys.length > 0) await redis.cacheDb.del(...keys, keystoreKey);
  const rules = await api.guilds.getAutoModerationRules(guildId).catch(() => []);
  rules.forEach((r) => redis.automods.set(r));
 }

 private async taskCommands(guildId: string): Promise<void> {
  if (!clientCache.user) return;

  const keystoreKey = redis.commands.keystore(guildId);
  const keys = await redis.cacheDb.hkeys(keystoreKey);
  if (keys.length > 0) await redis.cacheDb.del(...keys, keystoreKey);

  const commands = await api.applicationCommands
   .getGuildCommands(clientCache.user.id, guildId)
   .catch(() => []);
  commands.forEach((c) => redis.guildCommands.set({ ...c, guild_id: guildId }));
 }

 private async taskCommandPermissions(guildId: string): Promise<void> {
  if (!clientCache.user) return;

  const keystoreKey = redis.commandPermissions.keystore(guildId);
  const keys = await redis.cacheDb.hkeys(keystoreKey);
  if (keys.length > 0) await redis.cacheDb.del(...keys, keystoreKey);

  const commandPerms = await api.applicationCommands
   .getGuildCommandsPermissions(clientCache.user.id, guildId)
   .catch(() => []);

  commandPerms.forEach((command) =>
   command.permissions.forEach((perm) => redis.commandPermissions.set(perm, guildId, command.id)),
  );
 }

 private async taskWelcomeScreen(guildId: string): Promise<void> {
  const guild = await redis.guilds.get(guildId);
  if (!guild) return;

  if (!guild.features.includes(GuildFeature.WelcomeScreenEnabled)) {
   const perms = await getGuildPerms.call(redis, guildId, clientCache.user?.id || '0');
   if ((perms.response & PermissionFlagsBits.ManageGuild) !== PermissionFlagsBits.ManageGuild) {
    return;
   }
  }

  const keystoreKey = redis.welcomeScreens.keystore(guildId);
  const keys = await redis.cacheDb.hkeys(keystoreKey);
  if (keys.length > 0) await redis.cacheDb.del(...keys, keystoreKey);

  const welcomeScreen = await api.guilds.getWelcomeScreen(guildId).catch(() => null);
  if (!welcomeScreen) return;

  redis.welcomeScreens.set(welcomeScreen, guildId);
 }

 private async taskOnboarding(guildId: string): Promise<void> {
  const guild = await redis.guilds.get(guildId);
  if (!guild) return;

  const perms = await getGuildPerms.call(redis, guildId, clientCache.user?.id || '0');
  if ((perms.response & PermissionFlagsBits.ManageGuild) !== PermissionFlagsBits.ManageGuild) {
   return;
  }

  const onboarding = await api.guilds.getOnboarding(guildId);
  redis.onboardings.set(onboarding);
 }

 private async taskScheduledEvents(guildId: string): Promise<void> {
  const keystoreKey = redis.events.keystore(guildId);
  const keys = await redis.cacheDb.hkeys(keystoreKey);
  if (keys.length > 0) await redis.cacheDb.del(...keys, keystoreKey);

  const scheduledEvents = await api.guilds
   .getScheduledEvents(guildId, { with_user_count: true })
   .catch(() => []);
  scheduledEvents.forEach((e) => redis.events.set(e));

  const members = (
   await Promise.all(scheduledEvents.map((e) => requestEventSubscribers(e)))
  ).flat();

  members.forEach((u) => {
   redis.users.set(u.user);
   redis.eventUsers.set(
    {
     guild_id: guildId,
     guild_scheduled_event_id: u.guildScheduledEventId,
     user: u.user,
     user_id: u.user.id,
     member: u.member,
    },
    guildId,
   );

   if (u.member) redis.members.set(u.member, guildId);
  });
 }

 private async taskWebhooks(guildId: string): Promise<void> {
  const perms = await getGuildPerms.call(redis, guildId, clientCache.user?.id || '0');
  if (
   (perms.response & PermissionFlagsBits.ManageWebhooks) !==
   PermissionFlagsBits.ManageWebhooks
  ) {
   return;
  }

  const keystoreKey = redis.webhooks.keystore(guildId);
  const keys = await redis.cacheDb.hkeys(keystoreKey);
  if (keys.length > 0) await redis.cacheDb.del(...keys, keystoreKey);

  const webhooks = await api.guilds.getWebhooks(guildId).catch(() => []);
  webhooks.forEach((w) => redis.webhooks.set(w));
 }

 private async taskIntegrations(guildId: string): Promise<void> {
  const perms = await getGuildPerms.call(redis, guildId, clientCache.user?.id || '0');
  if ((perms.response & PermissionFlagsBits.ManageGuild) !== PermissionFlagsBits.ManageGuild) {
   return;
  }

  const keystoreKey = redis.integrations.keystore(guildId);
  const keys = await redis.cacheDb.hkeys(keystoreKey);
  if (keys.length > 0) await redis.cacheDb.del(...keys, keystoreKey);

  const integrations = await api.guilds.getIntegrations(guildId).catch(() => []);
  integrations.forEach((i) => redis.integrations.set(i, guildId));
 }

 private async taskInvites(guildId: string): Promise<void> {
  const perms = await getGuildPerms.call(redis, guildId, clientCache.user?.id || '0');
  if ((perms.response & PermissionFlagsBits.ManageGuild) !== PermissionFlagsBits.ManageGuild) {
   if ((perms.response & PermissionFlagsBits.ViewAuditLog) !== PermissionFlagsBits.ViewAuditLog) {
    return;
   }
  }

  const keystoreKey = redis.invites.keystore(guildId);
  const keys = await redis.cacheDb.hkeys(keystoreKey);
  const guildCodestoreKey = redis.invites.codestore(guildId);
  const globalCodestoreKey = redis.invites.codestore();

  const codes = await redis.cacheDb.hkeys(guildCodestoreKey);

  if (keys.length > 0) await redis.cacheDb.del(...keys, keystoreKey, guildCodestoreKey);
  if (codes.length > 0) await redis.cacheDb.hdel(globalCodestoreKey, ...codes);

  const invites = await api.guilds.getInvites(guildId).catch(() => []);
  invites.forEach((i) => redis.invites.set(i));
 }

 //#region Channel Tasks

 private async taskPins(channelId: string, guildId: string): Promise<void> {
  const channelPerms = await getChannelPerms.call(
   redis,
   guildId,
   clientCache.user?.id || '0',
   channelId,
  );
  const readPerms = PermissionFlagsBits.ViewAuditLog | PermissionFlagsBits.ReadMessageHistory;
  if ((channelPerms.allow & readPerms) !== readPerms) return;

  await redis.pins.delAll(channelId);

  const pins = await api.channels.getPins(channelId);

  for (let i = 0; i < pins.length; i++) {
   const pin = pins[i];
   redis.pins.set(channelId, pin.id);
   redis.messages.set(pin, guildId);
   (pins as unknown[])[i] = undefined;
  }
  pins.length = 0;
 }

 //#region Utilities

 private isRateLimitError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
   return (error as { status: number }).status === 429;
  }
  return false;
 }

 private getRateLimitRetryAfter(error: unknown): number {
  if (error && typeof error === 'object') {
   if ('rawError' in error) {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { rawError } = error as { rawError: { retry_after?: number } };
    if (rawError?.retry_after) {
     return Math.ceil(rawError.retry_after * 1000);
    }
   }
  }
  return CONFIG.DEFAULT_RETRY_AFTER;
 }
}

export const restQueue = new RestQueue();
