/**
 * Priority Queue System
 *
 * Provides throttled request handling to prevent Discord API rate limits
 * after Redis FLUSHDB or cold starts.
 *
 * Usage:
 * ```ts
 * import { priorityQueue } from './PriorityQueue/index.js';
 *
 * // Start on bot initialization
 * priorityQueue.start();
 *
 * // Enqueue requests
 * priorityQueue.enqueueGuildTasks(guildId, memberCount);
 * priorityQueue.enqueueMembers(guildId, memberCount);
 * priorityQueue.enqueueChannelPins(channelId, guildId, memberCount);
 *
 * // Notify when member chunks complete
 * priorityQueue.onMemberChunkComplete(guildId);
 * ```
 */

import { gatewayQueue } from './GatewayQueue.js';
import { restQueue } from './RestQueue.js';
import type { GuildTaskName } from './types.js';

export * from './types.js';
export { BinaryHeap } from './BinaryHeap.js';
export { gatewayQueue } from './GatewayQueue.js';
export { restQueue } from './RestQueue.js';

/**
 * Unified interface for the priority queue system
 */
export const priorityQueue = {
 /**
  * Start all queue processors
  */
 start(): void {
  gatewayQueue.start();
  restQueue.start();
 },

 /**
  * Stop all queue processors
  */
 stop(): void {
  gatewayQueue.stop();
  restQueue.stop();
 },

 /**
  * Enqueue all guild tasks for first guild interaction
  * @param guildId Guild ID
  * @param memberCount Approximate member count for priority
  */
 enqueueGuildTasks(guildId: string, memberCount: number): void {
  restQueue.enqueueGuildTasks(guildId, memberCount);
 },

 /**
  * Enqueue a single guild task (for subsequent updates, not first interaction)
  * @param guildId Guild ID
  * @param memberCount Approximate member count for priority
  * @param taskName The specific task to enqueue
  */
 enqueueGuildTask(guildId: string, memberCount: number, taskName: GuildTaskName): void {
  restQueue.enqueueGuildTask(guildId, memberCount, taskName);
 },

 /**
  * Enqueue member chunk request for a guild
  * @param guildId Guild ID
  * @param memberCount Approximate member count for priority
  */
 async enqueueMembers(guildId: string, memberCount: number): Promise<void> {
  await gatewayQueue.enqueue(guildId, memberCount);
 },

 /**
  * Enqueue channel pins request
  * @param channelId Channel ID
  * @param guildId Guild ID
  * @param memberCount Guild member count for priority
  */
 enqueueChannelPins(channelId: string, guildId: string, memberCount: number): void {
  restQueue.enqueueChannelTask(channelId, guildId, memberCount, 'pins');
 },

 /**
  * Notify that member chunks have completed for a guild
  * @param guildId Guild ID
  */
 onMemberChunkComplete(guildId: string): void {
  gatewayQueue.onChunkComplete(guildId);
 },

 /**
  * Get current queue sizes (for monitoring)
  */
 getStats(): { gatewayQueue: number; restQueue: number; activeRestRequests: number } {
  return {
   gatewayQueue: gatewayQueue.size,
   restQueue: restQueue.size,
   activeRestRequests: restQueue.active,
  };
 },

 /**
  * Get the guild currently waiting for member chunks
  */
 get currentMemberRequestGuild(): string | null {
  return gatewayQueue.currentGuild;
 },
};
