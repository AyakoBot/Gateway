import type { Cache } from '@ayako/utility';
import type { GatewayDispatchEvents, GatewayDispatchPayload } from 'discord-api-types/gateway/v10';

export default function (
 this: Cache,
 type: GatewayDispatchEvents,
 data: GatewayDispatchPayload['d'],
) {
 this.logger.debug(`[EventBus] Emitting event: ${type}`);

 this.cachePub.publish(type, JSON.stringify(data));
}
