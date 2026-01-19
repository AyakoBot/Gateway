import { getRandom } from '@ayako/utility';

import cache from '../BaseClient/Bot/Cache.js';
import { cache as clientCache } from '../BaseClient/Bot/Client.js';

import { priorityQueue } from './PriorityQueue/index.js';

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

 if (!guildId) return false;

 const memberCount = clientCache.members.get(guildId) || 0;
 priorityQueue.enqueueChannelPins(channelId, guildId, memberCount);

 return true;
};
