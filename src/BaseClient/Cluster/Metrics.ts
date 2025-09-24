import { scheduleJob } from 'node-schedule';
import { Gauge, Registry } from 'prom-client';

import { cacheDB } from './Redis.js';

const registry = new Registry();

const guildCount = new Gauge({
 name: 'ayako_guild_count',
 help: 'Amount of Guilds Ayako is in',
 labelNames: [],
});

const userCount = new Gauge({
 name: 'ayako_user_count',
 help: 'Amount of Users Ayako manages',
 labelNames: [],
});

const emojiCount = new Gauge({
 name: 'ayako_emoji_count',
 help: 'Amount of Emojis Ayako has access to',
 labelNames: [],
});

const roleCount = new Gauge({
 name: 'ayako_role_count',
 help: 'Amount of Roles Ayako has access to',
 labelNames: [],
});

const channelCount = new Gauge({
 name: 'ayako_channel_count',
 help: 'Amount of Channels Ayako has access to',
 labelNames: [],
});

const stickerCount = new Gauge({
 name: 'ayako_sticker_count',
 help: 'Amount of Stickers Ayako has access to',
 labelNames: [],
});

const soundCount = new Gauge({
 name: 'ayako_sound_count',
 help: 'Amount of Sounds Ayako has access to',
 labelNames: [],
});

const clusterCount = new Gauge({
 name: 'ayako_cluster_count',
 help: 'Amount of Clusters Ayako is running',
 labelNames: [],
});

const shardCount = new Gauge({
 name: 'ayako_shard_count',
 help: 'Amount of Shards Ayako is running',
 labelNames: [],
});

registry.registerMetric(guildCount);
registry.registerMetric(userCount);
registry.registerMetric(emojiCount);
registry.registerMetric(roleCount);
registry.registerMetric(channelCount);
registry.registerMetric(guildCount);
registry.registerMetric(soundCount);
registry.registerMetric(stickerCount);
registry.registerMetric(clusterCount);
registry.registerMetric(shardCount);

export default {
 guildCount: (count: number) => guildCount.labels().set(count),
 userCount: (count: number) => userCount.labels().set(count),
 emojiCount: (count: number) => emojiCount.labels().set(count),
 roleCount: (count: number) => roleCount.labels().set(count),
 channelCount: (count: number) => channelCount.labels().set(count),
 stickerCount: (count: number) => stickerCount.labels().set(count),
 soundCount: (count: number) => soundCount.labels().set(count),
 clusterCount: (count: number) => clusterCount.labels().set(count),
 shardCount: (count: number) => shardCount.labels().set(count),
};

scheduleJob('metrics', '*/5 * * * * *', async () => {
 cacheDB.set('metrics:cluster', await registry.metrics());
});
