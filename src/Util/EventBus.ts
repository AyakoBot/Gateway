import type { GatewayDispatchEvents, GatewayDispatchPayload } from 'discord-api-types/v10';

import cache from '../BaseClient/Bot/Redis.js';

const emit = (type: GatewayDispatchEvents, data: GatewayDispatchPayload['d']) => {
 // eslint-disable-next-line no-console
 if (process.argv.includes('--debug')) console.log(`[EventBus] Emitting event: ${type}`);

 cache.cacheDb.publish(type, JSON.stringify(data));
};

export default emit;
