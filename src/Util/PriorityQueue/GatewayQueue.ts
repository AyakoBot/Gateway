/**
 * Gateway Queue - Handles member chunk requests via Gateway opcode 8
 *
 * - Single request at a time (must wait for all chunks)
 * - Priority by member count (larger guilds first)
 * - Notified when chunks complete via onChunkComplete()
 */
import { getRandom } from '@ayako/utility';
import { GatewayOpcodes } from 'discord-api-types/gateway/v10';

import RedisCache from '../../BaseClient/Bot/Cache.js';
import { gateway } from '../../BaseClient/Bot/Client.js';
import calculateShardId from '../calculateShardId.js';

import { BinaryHeap } from './BinaryHeap.js';
import { CONFIG, type GatewayQueueItem } from './types.js';

/**
 * Priority comparator for gateway queue items
 * Higher member count = higher priority (comes first)
 * Equal member count: FIFO by addedAt
 */
const gatewayComparator = (a: GatewayQueueItem, b: GatewayQueueItem): number => {
 if (a.memberCount !== b.memberCount) return b.memberCount - a.memberCount;
 return a.addedAt - b.addedAt;
};

class GatewayQueue {
 private queue = new BinaryHeap<GatewayQueueItem>(gatewayComparator);
 private currentGuildId: string | null = null;
 private processingInterval: ReturnType<typeof setInterval> | null = null;
 private isProcessing = false;
 private chunkTimeout: ReturnType<typeof setTimeout> | null = null;
 private static readonly chunkTimeoutMS = 30000;

 /**
  * Get the currently processing guild ID
  */
 get currentGuild(): string | null {
  return this.currentGuildId;
 }

 /**
  * Get the number of items in the queue
  */
 get size(): number {
  return this.queue.size;
 }

 /**
  * Start the queue processing interval
  */
 start(): void {
  if (this.processingInterval) return;
  this.processingInterval = setInterval(() => {
   this.process().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[GatewayQueue] Error processing queue:', err);
   });
  }, CONFIG.GATEWAY_INTERVAL);
  // eslint-disable-next-line no-console
  console.log('[GatewayQueue] Started');
 }

 /**
  * Stop the queue processing interval
  */
 stop(): void {
  if (this.processingInterval) {
   clearInterval(this.processingInterval);
   this.processingInterval = null;
  }

  if (this.chunkTimeout) {
   clearTimeout(this.chunkTimeout);
   this.chunkTimeout = null;
  }

  // eslint-disable-next-line no-console
  console.log('[GatewayQueue] Stopped');
 }

 /**
  * Add a guild to the queue for member chunk request
  * @param guildId Guild ID
  * @param memberCount Approximate member count for priority
  */
 async enqueue(guildId: string, memberCount: number): Promise<void> {
  if (memberCount === 0) return;

  if (this.currentGuildId === guildId) return;
  if (this.queue.has((item) => item.guildId === guildId)) return;

  const [alreadyRequested] = await RedisCache.execPipeline<[string | null]>((pipeline) => {
   pipeline.hget('guild-members-requested', guildId);
   pipeline.hset('guild-members-requested', guildId, '1');
   pipeline.call(
    'hexpire',
    'guild-members-requested',
    getRandom(604800 / 2, 604800),
    'NX',
    'FIELDS',
    1,
    guildId,
   );
  });
  if (alreadyRequested === '1') return;

  this.queue.push({
   type: 'gateway',
   guildId,
   memberCount,
   addedAt: Date.now(),
  });
 }

 /**
  * Called when all member chunks have been received for a guild
  * This unblocks the queue to process the next guild
  */
 onChunkComplete(guildId: string): void {
  if (this.currentGuildId === guildId) {
   this.currentGuildId = null;

   if (this.chunkTimeout) {
    clearTimeout(this.chunkTimeout);
    this.chunkTimeout = null;
   }
  }
 }

 /**
  * Process the next item in the queue
  */
 private async process(): Promise<void> {
  if (this.isProcessing) return;
  if (this.currentGuildId !== null) return;
  if (this.queue.isEmpty) return;

  this.isProcessing = true;

  try {
   const item = this.queue.pop();
   if (!item) return;

   this.currentGuildId = item.guildId;

   gateway.send(calculateShardId(item.guildId), {
    op: GatewayOpcodes.RequestGuildMembers,
    d: { guild_id: item.guildId, presences: false, limit: 0, query: '' },
   });

   this.chunkTimeout = setTimeout(() => {
    if (this.currentGuildId === item.guildId) {
     // eslint-disable-next-line no-console
     console.log(`[GatewayQueue] Timeout waiting for chunks from ${item.guildId}, skipping`);
     this.currentGuildId = null;
     this.chunkTimeout = null;
    }
   }, GatewayQueue.chunkTimeoutMS);

   // eslint-disable-next-line no-console
   console.log(
    `[GatewayQueue] Requested members for ${item.guildId} (${item.memberCount} members) | Queue: ${this.queue.size}`,
   );
  } finally {
   this.isProcessing = false;
  }
 }
}

export const gatewayQueue = new GatewayQueue();
