import { GatewayOpcodes } from 'discord-api-types/v10';
import { scheduleJob } from 'node-schedule';
import { Counter, Gauge, Registry } from 'prom-client';

import redis from './Redis.js';

const registry = new Registry();

const dispatchEventsReceived = new Counter({
 name: 'ayako_gateway_dispatch_events',
 help: 'Individual dispatch events received',
 labelNames: ['eventType', 'shard'],
});

const shardLatency = new Gauge({
 name: 'ayako_gateway_shard_latency',
 help: 'Latency of each shard',
 labelNames: ['shard'],
});

const shardEventsReceived = new Counter({
 name: 'ayako_gateway_shard_receive_events',
 help: 'Individual shard events received',
 labelNames: ['opCode', 'shard'],
});

const userInstallCount = new Gauge({
 name: 'ayako_user_install_count',
 help: 'Amount of Users Ayako is installed on',
 labelNames: [],
});

const userAuthCount = new Gauge({
 name: 'ayako_user_auth_count',
 help: 'Amount of Users Ayako is authorized on',
 labelNames: [],
});

registry.registerMetric(dispatchEventsReceived);
registry.registerMetric(shardLatency);
registry.registerMetric(shardEventsReceived);
registry.registerMetric(userInstallCount);
registry.registerMetric(userAuthCount);

export default {
 dispatchEventsReceived: (eventType: string, shard: number) =>
  dispatchEventsReceived.labels(eventType, String(shard)).inc(),

 shardLatency: (latency: number, shard: number) => shardLatency.labels(String(shard)).set(latency),

 shardEventsReceived: (opCode: GatewayOpcodes, shard: number) =>
  shardEventsReceived
   .labels(
    Object.entries(GatewayOpcodes).find(([, val]) => val === opCode)?.[0] || 'Unknown',
    String(shard),
   )
   .inc(),

 userInstallCount: (count: number) => userInstallCount.labels().set(count),
 userAuthCount: (count: number) => userAuthCount.labels().set(count),
};

scheduleJob('metrics', '*/5 * * * * *', async () => {
 redis.cacheDb.set('metrics:bot', await registry.metrics());
});
