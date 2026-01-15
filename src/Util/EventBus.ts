import type { GatewayDispatchEvents, GatewayDispatchPayload } from 'discord-api-types/gateway/v10';

import cache from '../BaseClient/Bot/Cache.js';

const emit = (type: GatewayDispatchEvents, data: GatewayDispatchPayload['d']) => {
 // eslint-disable-next-line no-console
 if (process.argv.includes('--debug')) console.log(`[EventBus] Emitting event: ${type}`);

 cache.cachePub.publish(type, JSON.stringify(data));
};

export default emit;
