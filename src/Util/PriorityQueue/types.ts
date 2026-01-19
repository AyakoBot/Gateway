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
 * Task names for REST API calls on first channel interaction
 */
export type ChannelTaskName = 'pins';

/**
 * Item in the REST queue
 */
export type RestQueueItem = {
 type: 'guild' | 'channel';
 id: string;
 guildId: string;
 memberCount: number;
 taskName: GuildTaskName | ChannelTaskName;
 endpoint: string;
 addedAt: number;
};

/**
 * Rate limit state for an endpoint
 */
export type RateLimitState = {
 endpoint: string;
 resetAt: number;
 paused: boolean;
};

/**
 * Queue configuration
 */
export const CONFIG = {
 /** Milliseconds between gateway queue processing */
 GATEWAY_INTERVAL: 100,
 /** Milliseconds between REST queue processing */
 REST_INTERVAL: 50,
 /** Maximum concurrent REST requests */
 REST_MAX_CONCURRENT: 5,
 /** Default retry after time in ms if not provided in 429 response */
 DEFAULT_RETRY_AFTER: 5000,
} as const;
