/**
 * Cold Start Detector
 *
 * Detects when the bot is in a "cold start" state after FLUSHDB or fresh deployment.
 * During cold start, event emission to Redis is suppressed to prevent queue overload
 * and events being sent with major delay due to paused queue.
 *
 * Cold start is detected when:
 * - guild-interacts, channel-interacts, hashes
 *   have fewer than 10% of the bot's guild count entries
 *
 * Cold start ends when:
 * - Redis queue size drops below 5000
 */
import redis from '../../BaseClient/Bot/Cache.js';
import { cache as clientCache } from '../../BaseClient/Bot/Client.js';

class ColdStartDetector {
 private isColdstart = false;
 private isInitialized = false;
 private checkInterval: ReturnType<typeof setInterval> | null = null;

 protected coldStartThresholdPercentage = 0.1;
 protected coldStartEndQueueSize = 5000;
 protected checkIntervalTime = 1000;

 /**
  * Whether the bot is currently in cold start mode
  */
 get isColdStart(): boolean {
  return this.isColdstart;
 }

 /**
  * Initialize cold start detection
  * Call this after the bot has received guild count from Discord
  */
 async initialize(): Promise<void> {
  if (this.isInitialized) return;
  this.isInitialized = true;

  const guildCount = clientCache.approxGuilds;
  if (guildCount === 0) {
   this.isColdstart = true;
   // eslint-disable-next-line no-console
   console.log('[ColdStart] Guild count is 0, assuming cold start');
   this.startEndCheck();
   return;
  }

  const threshold = Math.floor(guildCount * this.coldStartThresholdPercentage);

  const guildInteractsSize = (await redis.cacheDb.call('HLEN', 'guild-interacts')) as number;
  const isCold = guildInteractsSize < threshold;

  if (isCold) {
   this.isColdstart = true;
   // eslint-disable-next-line no-console
   console.log(
    `[ColdStart] Detected cold start | Guilds: ${guildCount} | Threshold: ${threshold} | ` +
     `guild-interacts: ${guildInteractsSize} | `,
   );

   this.startEndCheck();
  } else {
   // eslint-disable-next-line no-console
   console.log(
    `[ColdStart] Normal start detected | Guilds: ${guildCount} | ` +
     `guild-interacts: ${guildInteractsSize}  | `,
   );
  }
 }

 /**
  * Start checking if cold start has ended
  */
 private startEndCheck(): void {
  if (this.checkInterval) return;

  this.checkInterval = setInterval(() => {
   this.checkColdStartEnd();
  }, this.checkIntervalTime);
 }

 /**
  * Check if cold start should end based on Redis queue size
  */
 private checkColdStartEnd(): void {
  const queueSize = redis.cacheDb.getQueueSize();

  if (queueSize < this.coldStartEndQueueSize) {
   this.isColdstart = false;

   if (this.checkInterval) {
    clearInterval(this.checkInterval);
    this.checkInterval = null;
   }

   // eslint-disable-next-line no-console
   console.log(`[ColdStart] Cold start ended | Redis queue size: ${queueSize}`);
  }
 }

 /**
  * Manually end cold start (for testing or manual override)
  */
 endColdStart(): void {
  this.isColdstart = false;

  if (this.checkInterval) {
   clearInterval(this.checkInterval);
   this.checkInterval = null;
  }

  // eslint-disable-next-line no-console
  console.log('[ColdStart] Cold start manually ended');
 }

 /**
  * Reset detector state (for testing)
  */
 reset(): void {
  this.isColdstart = false;
  this.isInitialized = false;

  if (this.checkInterval) {
   clearInterval(this.checkInterval);
   this.checkInterval = null;
  }
 }
}

export const coldStartDetector = new ColdStartDetector();
