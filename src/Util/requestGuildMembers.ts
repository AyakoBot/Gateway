import { cache } from '../BaseClient/Bot/Client.js';

import { priorityQueue } from './PriorityQueue/index.js';

const requestGuildMembers = async (guildId: string): Promise<void> => {
 const memberCount = cache.members.get(guildId) || 0;
 await priorityQueue.enqueueMembers(guildId, memberCount);
};

export default requestGuildMembers;
