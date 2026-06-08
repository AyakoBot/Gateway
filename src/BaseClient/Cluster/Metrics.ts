import { scheduleJob } from 'node-schedule';
import { Gauge, Registry } from 'prom-client';

import { cacheDB } from './Redis.js';

const registry = new Registry();

const guildCount = new Gauge({
 name: 'ayako_guild_count',
 help: 'Amount of Guilds',
 labelNames: ['key'],
});

const userCount = new Gauge({
 name: 'ayako_user_count',
 help: 'Amount of Users',
 labelNames: ['key'],
});

const emojiCount = new Gauge({
 name: 'ayako_emoji_count',
 help: 'Amount of Emojis',
 labelNames: ['key'],
});

const roleCount = new Gauge({
 name: 'ayako_role_count',
 help: 'Amount of Roles',
 labelNames: ['key'],
});

const channelCount = new Gauge({
 name: 'ayako_channel_count',
 help: 'Amount of Channels',
 labelNames: ['key'],
});

const stickerCount = new Gauge({
 name: 'ayako_sticker_count',
 help: 'Amount of Stickers',
 labelNames: ['key'],
});

const soundCount = new Gauge({
 name: 'ayako_sound_count',
 help: 'Amount of Sounds',
 labelNames: ['key'],
});

registry.registerMetric(guildCount);
registry.registerMetric(userCount);
registry.registerMetric(emojiCount);
registry.registerMetric(roleCount);
registry.registerMetric(channelCount);
registry.registerMetric(guildCount);
registry.registerMetric(soundCount);
registry.registerMetric(stickerCount);

export default {
 guildCount: (key: string, count: number) => guildCount.labels(key).set(count),
 userCount: (key: string, count: number) => userCount.labels(key).set(count),
 emojiCount: (key: string, count: number) => emojiCount.labels(key).set(count),
 roleCount: (key: string, count: number) => roleCount.labels(key).set(count),
 channelCount: (key: string, count: number) => channelCount.labels(key).set(count),
 stickerCount: (key: string, count: number) => stickerCount.labels(key).set(count),
 soundCount: (key: string, count: number) => soundCount.labels(key).set(count),
};

scheduleJob('metrics', '*/5 * * * * *', async () => {
 cacheDB.set('metrics:cluster', await registry.metrics());
});
