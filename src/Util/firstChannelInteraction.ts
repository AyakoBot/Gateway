import { getRandom } from '@ayako/utility';

import cache from '../BaseClient/Bot/Cache.js';

import requestChannelPins from './requestChannelPins.js';

export default async (channelId: string, guildId: string) => {
 if (!channelId) return false;

 const [isMember] = await cache.execPipeline<[string | null]>((pipeline) => {
  pipeline.hget('channel-interacts', channelId);
  pipeline.hset('channel-interacts', channelId, '1');
  pipeline.call(
   'hexpire',
   'channel-interacts',
   getRandom(604800 / 2, 604800),
   'NX',
   'FIELDS',
   1,
   channelId,
  );
 });
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
