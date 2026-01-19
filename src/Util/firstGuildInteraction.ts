import { getRandom } from '@ayako/utility';

import cache from '../BaseClient/Bot/Cache.js';
import { cache as clientCache } from '../BaseClient/Bot/Client.js';

import { priorityQueue } from './PriorityQueue/index.js';

export default async (guildId: string) => {
 const [isMember] = await cache.execPipeline<[string | null]>((pipeline) => {
  pipeline.hget('guild-interacts', guildId);
  pipeline.hset('guild-interacts', guildId, '1');
  pipeline.call(
   'hexpire',
   'guild-interacts',
   getRandom(604800 / 2, 604800),
   'NX',
   'FIELDS',
   1,
   guildId,
  );
 });
 if (isMember === '1') return false;

 const memberCount = clientCache.members.get(guildId) || 0;

 priorityQueue.enqueueGuildTasks(guildId, memberCount);
 await priorityQueue.enqueueMembers(guildId, memberCount);

 return true;
};
