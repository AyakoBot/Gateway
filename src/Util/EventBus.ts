import type { GatewayDispatchEvents, GatewayDispatchPayload } from 'discord-api-types/v10.js';

import cacheDB from '../BaseClient/Bot/Redis.js';

const emit = (type: GatewayDispatchEvents, data: GatewayDispatchPayload['d']) => {
 // eslint-disable-next-line no-console
 if (process.argv.includes('--debug')) console.log(`[EventBus] Emitting event: ${type}`, data);

 cacheDB.publish(type, JSON.stringify(data));
};

export default emit;
