import requestChannelPins from './requestChannelPins.js';

const channels = new Set<string>();

export default async (channelId: string, guildId: string) => {
 if (!channelId) return false;

 if (channels.has(channelId)) return false;
 channels.add(channelId);

 await Promise.allSettled(Object.values(tasks).map((t) => t(channelId, guildId)));
 return true;
};

export const tasks = {
 pins: (channelId: string, guildId: string) => requestChannelPins(channelId, guildId),
};
