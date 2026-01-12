import RedisClient from '../BaseClient/Bot/Redis.js';

import requestChannelPins from './requestChannelPins.js';

export default async (channelId: string, guildId: string) => {
 if (!channelId) return false;

 const pipeline = RedisClient.pipeline();
 pipeline.hget('channel-interacts', channelId);
 pipeline.hset('channel-interacts', channelId, '1');
 pipeline.call('hexpire', 'channel-interacts', 604800, 'NX', 'FIELDS', 1, channelId);

 const [isMember] = await pipeline.exec().then((res) => (res || [])?.map((r) => r[1]));
 if (isMember === '1') return false;

 await Promise.allSettled(Object.values(tasks).map((t) => t(channelId, guildId)));
 return true;
};

export const tasks = {
 pins: async (channelId: string, guildId: string) => {
  if (!guildId) return;
  await requestChannelPins(channelId, guildId);
 },
};
