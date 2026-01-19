import cache from '../BaseClient/Bot/Cache.js';
import { cache as clientCache } from '../BaseClient/Bot/Client.js';

import { priorityQueue } from './PriorityQueue/index.js';

const requestChannelPins = async (channelId: string, guildId: string): Promise<void> => {
 if (!channelId || !guildId) return;

 const [alreadyRequested] = await cache.execPipeline<[string | null]>((pipeline) => {
  pipeline.hget('channel-pins-requested', channelId);
  pipeline.hset('channel-pins-requested', channelId, '1');
  pipeline.call('hexpire', 'channel-pins-requested', 300, 'NX', 'FIELDS', 1, channelId);
 });
 if (alreadyRequested === '1') return;

 const memberCount = clientCache.members.get(guildId) || 0;
 priorityQueue.enqueueChannelPins(channelId, guildId, memberCount);
};

export default requestChannelPins;
