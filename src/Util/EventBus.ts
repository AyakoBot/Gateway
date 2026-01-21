import type { Cache } from '@ayako/utility';
import type { GatewayDispatchEvents, GatewayDispatchPayload } from 'discord-api-types/gateway/v10';

import { priorityQueue } from './PriorityQueue/index.js';

export default function (
 this: Cache,
 type: GatewayDispatchEvents,
 data: GatewayDispatchPayload['d'],
) {
 if (priorityQueue.isColdStart) {
  this.logger.debug(`[EventBus] Skipping event during cold start: ${type}`);
  return;
 }

 this.logger.debug(`[EventBus] Emitting event: ${type}`);

 this.cachePub.publish(type, JSON.stringify(data));
}
