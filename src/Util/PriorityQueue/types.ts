/**
 * Types for Priority Queue system
 * Used to throttle Discord API requests after FLUSHDB
 */

/**
 * Item in the Gateway queue (member chunk requests)
 */
export type GatewayQueueItem = {
 type: 'gateway';
 guildId: string;
 memberCount: number;
 addedAt: number;
};

/**
 * Task names for REST API calls on first guild interaction
 */
export type GuildTaskName =
 | 'autoModRules'
 | 'commands'
 | 'commandPermissions'
 | 'welcomeScreen'
 | 'onboarding'
 | 'scheduledEvents'
 | 'webhooks'
 | 'integrations'
 | 'invites'
 | 'vcStatus';

/**
 * Item in the REST queue
 */
export type RestQueueItem = {
 type: 'guild';
 id: string;
 guildId: string;
 memberCount: number;
 taskName: GuildTaskName;
 endpoint: string;
 addedAt: number;
};

/**
 * Rate limit bucket from Discord
 * Multiple routes can share the same bucket (identified by bucketHash)
 */
export type BucketState = {
 /** The bucket hash from X-RateLimit-Bucket header, or pseudo-hash for unknown buckets */
 bucketHash: string;
 /** Normalized route pattern (e.g., "channels/:id/pins") */
 route: string;
 /** HTTP method */
 method: string;
 /** Number of requests remaining before rate limit */
 remaining: number;
 /** Total requests allowed per window */
 limit: number;
 /** Timestamp when the bucket resets (ms since epoch) */
 resetAt: number;
 /** Whether this bucket is currently blocked */
 blocked: boolean;
 /** Rate limit scope: 'user', 'global', or 'shared' */
 scope: 'user' | 'global' | 'shared';
};

/**
 * Queue configuration
 */
export const CONFIG = {
 /** Milliseconds between gateway queue processing */
 GATEWAY_INTERVAL: 100,
 /** Milliseconds between REST queue processing */
 REST_INTERVAL: 100,
 /** Maximum concurrent REST requests*/
 REST_MAX_CONCURRENT: 5,
 /** Default retry after time in ms if not provided in 429 response */
 DEFAULT_RETRY_AFTER: 5000,
 /** Redis queue size threshold for backpressure - don't start new tasks if above this */
 REDIS_QUEUE_THRESHOLD: 10000,
 /** Task execution timeout in ms - prevents hanging tasks from blocking the queue */
 TASK_TIMEOUT: 30000,
} as const;
