/**
 * REST Queue - Handles all Discord REST API calls with rate limiting
 *
 * - Max 5 concurrent requests (configurable)
 * - Per-endpoint rate limit tracking
 * - Re-queues on 429 with retry_after delay
 * - Priority by member count (larger guilds first)
 */
import {
 getGuildPerms,
 type RChannelTypes,
 type RStageInstance,
 type RVoiceState,
} from '@ayako/utility';
import { RESTEvents } from '@discordjs/rest';
import {
 GuildFeature,
 PermissionFlagsBits,
 type APIGuildChannel,
 type APIThreadChannel,
 type ThreadChannelType,
} from 'discord-api-types/v10';

import redis from '../../BaseClient/Bot/Cache.js';
import { api, cache as clientCache } from '../../BaseClient/Bot/Client.js';
import requestEventSubscribers from '../requestEventSubscribers.js';
import requestVoiceChannelStatuses from '../requestVoiceChannelStatuses.js';

import { BinaryHeap } from './BinaryHeap.js';
import { CONFIG, type BucketState, type GuildTaskName, type RestQueueItem } from './types.js';

/**
 * Priority comparator for REST queue items
 * Higher member count = higher priority
 * Equal member count: FIFO by addedAt
 */
const restComparator = (a: RestQueueItem, b: RestQueueItem): number => {
 if (a.memberCount !== b.memberCount) return b.memberCount - a.memberCount;
 return a.addedAt - b.addedAt;
};

class RestQueue {
 private queue = new BinaryHeap<RestQueueItem>(restComparator);
 private activeRequests = 0;
 private processingInterval: ReturnType<typeof setInterval> | null = null;
 private isProcessing = false;
 private completedCount = 0;
 private inFlight = new Set<string>();

 private buckets = new Map<string, BucketState>();
 private routeToBucket = new Map<string, string>();

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

  this.setupRateLimitListener();

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
  * Generate a unique key for a task (used for in-flight tracking)
  */
 private getTaskKey(id: string, taskName: string): string {
  return `guild:${id}:${taskName}`;
 }

 /**
  * Check if a guild task is already queued or in-flight
  */
 private hasGuildTask(guildId: string, taskName?: string): boolean {
  if (taskName) {
   if (this.inFlight.has(this.getTaskKey(guildId, taskName))) return true;
  } else {
   for (const key of this.inFlight) {
    if (key.startsWith(`guild:${guildId}:`)) return true;
   }
  }
  return this.queue.has(
   (item) => item.guildId === guildId && (taskName ? item.taskName === taskName : true),
  );
 }

 //#region Bucket-Based Rate Limiting

 /**
  * Normalize an endpoint to a route pattern for bucket grouping
  * Converts: "channels/123456789012345678/pins" -> "channels/:id/pins"
  */
 private normalizeRoute(endpoint: string): string {
  return endpoint
   .replace(/\d{17,19}/g, ':id')
   .replace(/\/reactions\/(.*)/, '/reactions/:reaction')
   .replace(/\/webhooks\/:id\/[^/?]+/, '/webhooks/:id/:token');
 }

 /**
  * Generate a bucket key combining method and normalized route
  */
 private generateBucketKey(method: string, endpoint: string): string {
  return `${method}:${this.normalizeRoute(endpoint)}`;
 }

 /**
  * Check if an endpoint is currently rate limited based on bucket
  */
 private isEndpointBlocked(method: string, endpoint: string): boolean {
  const bucketKey = this.generateBucketKey(method, endpoint);
  const bucketHash = this.routeToBucket.get(bucketKey);

  if (!bucketHash) return false; // Unknown bucket - allow request

  const bucket = this.buckets.get(bucketHash);
  if (!bucket) return false;

  const now = Date.now();

  // Check if bucket has reset
  if (now >= bucket.resetAt) {
   bucket.blocked = false;
   bucket.remaining = bucket.limit;
   return false;
  }

  return bucket.blocked;
 }

 /**
  * Setup listener for REST rate limit events via Response event
  */
 private setupRateLimitListener(): void {
  api.rest.on(RESTEvents.Response, (request, response) => {
   if (response.status !== 429) return;

   const retryAfter = response.headers.get('retry-after');
   const bucket = response.headers.get('x-ratelimit-bucket');
   const scope = response.headers.get('x-ratelimit-scope') as 'user' | 'global' | 'shared' | null;

   if (!retryAfter) return;

   const retryAfterMs = parseFloat(retryAfter) * 1000;
   const route = this.normalizeRoute(request.path);
   const bucketKey = this.generateBucketKey(request.method, request.path);
   const bucketHash = bucket ?? `unknown:${route}`;

   this.routeToBucket.set(bucketKey, bucketHash);
   this.buckets.set(bucketHash, {
    bucketHash,
    route,
    method: request.method,
    remaining: 0,
    limit: 1,
    resetAt: Date.now() + retryAfterMs,
    blocked: true,
    scope: scope ?? 'user',
   });

   // eslint-disable-next-line no-console
   console.log(
    `[RestQueue] Bucket learned from 429: ${route} -> ${bucketHash} (retry in ${retryAfterMs}ms)`,
   );
  });
 }

 //#endregion

 /**
  * Enqueue all guild tasks for first guild interaction
  */
 enqueueGuildTasks(guildId: string, memberCount: number): void {
  if (this.hasGuildTask(guildId)) return;

  const now = Date.now();
  const guildTasks: GuildTaskName[] = [
   // Exact endpoint names
   'commands',
   'welcome-screen',
   'onboarding',
   'webhooks',
   'integrations',
   'invites',
   'channels',
   'roles',
   'emojis',
   'stickers',
   'scheduled-events',
   'soundboard-sounds',

   // Not exact endpoint names
   'auto-moderation',
   'threads',
   'command-permissions',
   'channel-status',

   // Custom logic tasks
   'stage-instances',
   'voice-states',
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

  // eslint-disable-next-line no-console
  console.log(
   `[RestQueue] Enqueued ${guildTasks.length} guild tasks for guilds/${guildId}/* | Queue: ${this.queue.size}`,
  );
 }

 /**
  * Enqueue a single guild task (for subsequent updates, not first interaction)
  */
 enqueueGuildTask(guildId: string, memberCount: number, taskName: GuildTaskName): void {
  if (this.hasGuildTask(guildId, taskName)) return;

  const endpoint = `guilds/${guildId}/${taskName}`;
  this.queue.push({
   type: 'guild',
   id: guildId,
   guildId,
   memberCount,
   taskName,
   endpoint,
   addedAt: Date.now(),
  });

  // eslint-disable-next-line no-console
  console.log(`[RestQueue] Enqueued ${endpoint} | Queue: ${this.queue.size}`);
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
  * Find the next item that isn't rate limited (using bucket-based checking)
  */
 private findNextUnblockedItem(): RestQueueItem | undefined {
  const items = this.queue.toArray();

  for (const item of items) {
   if (!this.isEndpointBlocked('GET', item.endpoint)) {
    this.queue.remove((it) => it === item);
    return item;
   }
  }

  return undefined;
 }

 /**
  * Handle rate limit (429) response - re-queue the item
  */
 private onRateLimit(item: RestQueueItem, retryAfter: number): void {
  this.queue.push(item);

  // eslint-disable-next-line no-console
  console.log(
   `[RestQueue] Rate limited on ${item.endpoint}, retry after ${retryAfter}ms | Queue: ${this.queue.size}`,
  );
 }

 /**
  * Execute a task with timeout
  */
 private async executeTask(item: RestQueueItem): Promise<void> {
  const taskKey = this.getTaskKey(item.id, item.taskName);
  this.inFlight.add(taskKey);
  this.activeRequests++;

  try {
   await Promise.race([
    this.executeGuildTask(item),
    new Promise<never>((_, reject) =>
     setTimeout(() => reject(new Error('Task timeout')), CONFIG.TASK_TIMEOUT),
    ),
   ]);

   this.completedCount++;
   if (this.completedCount % 10 === 0) {
    // eslint-disable-next-line no-console
    console.log(
     `[RestQueue] Completed ${this.completedCount} requests | Queue: ${this.queue.size} | Active: ${this.activeRequests}`,
    );
   }
  } catch (error: unknown) {
   if (this.isRateLimitError(error)) {
    const retryAfter = this.getRateLimitRetryAfter(error);
    this.onRateLimit(item, retryAfter);
   } else if (error instanceof Error && error.message === 'Task timeout') {
    // eslint-disable-next-line no-console
    console.log(`[RestQueue] Task timeout: ${item.endpoint} - letting djs handle it`);
   }
  } finally {
   this.inFlight.delete(taskKey);
   this.activeRequests--;
  }
 }

 /**
  * Execute a guild task
  */
 private async executeGuildTask(item: RestQueueItem): Promise<void> {
  const { guildId } = item;

  const expireTime = await redis.cacheDb.expiretime(redis.guilds.key(guildId));
  const remainingTTL = Math.abs(expireTime * 1000 - Date.now());
  if (remainingTTL > 604800 / 2) return;

  switch (item.taskName) {
   case 'auto-moderation':
    await this.taskAutoModRules(guildId);
    break;

   case 'commands':
    await this.taskCommands(guildId);
    break;

   case 'command-permissions':
    await this.taskCommandPermissions(guildId);
    break;

   case 'welcome-screen':
    await this.taskWelcomeScreen(guildId);
    break;

   case 'onboarding':
    await this.taskOnboarding(guildId);
    break;

   case 'scheduled-events':
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

   case 'channels':
    await this.taskChannels(guildId);
    break;

   case 'roles':
    await this.taskRoles(guildId);
    break;

   case 'emojis':
    await this.taskEmojis(guildId);
    break;

   case 'stickers':
    await this.taskStickers(guildId);
    break;

   case 'soundboard-sounds':
    await this.taskSoundboardSounds(guildId);
    break;

   case 'threads':
    await this.taskThreads(guildId);
    break;

   case 'stage-instances':
    await this.taskStageInstances(guildId);
    break;

   case 'voice-states':
    await this.taskVoiceStates(guildId);
    break;

   case 'channel-status':
    await this.taskChannelStatus(guildId);
    break;

   default:
    break;
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
  if (keys.length) await redis.cacheDb.del(...keys, keystoreKey);
  const rules = await api.guilds.getAutoModerationRules(guildId).catch(() => []);
  rules.forEach((r) => redis.automods.set(r));
 }

 private async taskCommands(guildId: string): Promise<void> {
  if (!clientCache.user) return;

  const keystoreKey = redis.commands.keystore(guildId);
  const keys = await redis.cacheDb.hkeys(keystoreKey);
  if (keys.length) await redis.cacheDb.del(...keys, keystoreKey);

  const commands = await api.applicationCommands
   .getGuildCommands(clientCache.user.id, guildId)
   .catch(() => []);
  commands.forEach((c) => redis.guildCommands.set({ ...c, guild_id: guildId }));
 }

 private async taskCommandPermissions(guildId: string): Promise<void> {
  if (!clientCache.user) return;

  const keystoreKey = redis.commandPermissions.keystore(guildId);
  const keys = await redis.cacheDb.hkeys(keystoreKey);
  if (keys.length) await redis.cacheDb.del(...keys, keystoreKey);

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
  if (keys.length) await redis.cacheDb.del(...keys, keystoreKey);

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
  if (keys.length) await redis.cacheDb.del(...keys, keystoreKey);

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
  if (keys.length) await redis.cacheDb.del(...keys, keystoreKey);

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
  if (keys.length) await redis.cacheDb.del(...keys, keystoreKey);

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

  if (keys.length) await redis.cacheDb.del(...keys, keystoreKey, guildCodestoreKey);
  if (codes.length) await redis.cacheDb.hdel(globalCodestoreKey, ...codes);

  const invites = await api.guilds.getInvites(guildId).catch(() => []);
  invites.forEach((i) => redis.invites.set(i));
 }

 private async taskRoles(guildId: string): Promise<void> {
  const keystoreKey = redis.roles.keystore(guildId);
  const keys = await redis.cacheDb.hkeys(keystoreKey);
  if (keys.length) await redis.cacheDb.del(...keys, keystoreKey);

  const roles = await api.guilds.getRoles(guildId).catch(() => []);
  roles.forEach((r) => redis.roles.set(r, guildId));
 }

 private async taskChannels(guildId: string): Promise<void> {
  const keystoreKey = redis.channels.keystore(guildId);
  const keys = await redis.cacheDb.hkeys(keystoreKey);
  if (keys.length) await redis.cacheDb.del(...keys, keystoreKey);

  const channels = await api.guilds.getChannels(guildId).catch(() => []);
  channels.forEach((r) => redis.channels.set(r as APIGuildChannel<RChannelTypes>));
 }

 private async taskEmojis(guildId: string): Promise<void> {
  const keystoreKey = redis.emojis.keystore(guildId);
  const keys = await redis.cacheDb.hkeys(keystoreKey);
  if (keys.length) await redis.cacheDb.del(...keys, keystoreKey);

  const emojis = await api.guilds.getEmojis(guildId).catch(() => []);
  emojis.forEach((e) => redis.emojis.set(e, guildId));
 }

 private async taskStickers(guildId: string): Promise<void> {
  const keystoreKey = redis.stickers.keystore(guildId);
  const keys = await redis.cacheDb.hkeys(keystoreKey);
  if (keys.length) await redis.cacheDb.del(...keys, keystoreKey);

  const stickers = await api.guilds.getStickers(guildId).catch(() => []);
  stickers.forEach((s) => redis.stickers.set(s));
 }

 private async taskThreads(guildId: string): Promise<void> {
  const keystoreKey = redis.threads.keystore(guildId);
  const keys = await redis.cacheDb.hkeys(keystoreKey);
  if (keys.length) await redis.cacheDb.del(...keys, keystoreKey);

  const threads = await api.guilds
   .getActiveThreads(guildId)
   .then((res) => res.threads)
   .catch(() => []);
  threads.forEach((t) => redis.threads.set(t as APIThreadChannel<ThreadChannelType>));
 }

 private async taskSoundboardSounds(guildId: string): Promise<void> {
  const keystoreKey = redis.soundboards.keystore(guildId);
  const keys = await redis.cacheDb.hkeys(keystoreKey);
  if (keys.length) await redis.cacheDb.del(...keys, keystoreKey);

  const soundboardSounds = await api.guilds.getSoundboardSounds(guildId).catch(() => null);
  soundboardSounds?.items.forEach((e) => redis.soundboards.set(e));
 }

 private async taskChannelStatus(guildId: string): Promise<void> {
  const statuses = await redis.channelStatus.getAll(guildId);
  if (Object.values(statuses).length) await redis.cacheDb.del(...Object.values(statuses));

  await requestVoiceChannelStatuses(guildId);
 }

 private async taskStageInstances(guildId: string): Promise<void> {
  const stages = await redis.stages.getAll(guildId);
  if (!stages.length) return;

  await redis.cacheDb.del(
   ...stages.map((s) => redis.stages.key(s.id)),
   redis.stages.keystore(guildId),
  );

  const existing = (
   await Promise.all(stages.map((s) => api.stageInstances.get(s.channel_id).catch(() => null)))
  ).filter((s): s is RStageInstance => !!s);

  existing.forEach((s) => redis.stages.set(s));
 }

 private async taskVoiceStates(guildId: string): Promise<void> {
  const voiceStates = await redis.voices.getAll(guildId);
  if (!voiceStates.length) return;

  await redis.cacheDb.del(
   ...voiceStates.map((s) => redis.voices.key(guildId, s.user_id)),
   redis.voices.keystore(guildId),
  );

  const existing = (
   await Promise.all(
    voiceStates.map((s) => api.voice.getUserVoiceState(guildId, s.user_id).catch(() => null)),
   )
  ).filter((s): s is RVoiceState => !!s);

  existing.forEach((s) => redis.voices.set(s));
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
