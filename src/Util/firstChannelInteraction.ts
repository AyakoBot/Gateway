import { api } from '../BaseClient/Bot/Client.js';
import { cache } from '../BaseClient/Bot/Redis.js';

import checkPermission from './checkPermission.js';

const channels = new Set<string>();

export default async (channelId: string, guildId: string) => {
 if (!channelId) return false;

 if (channels.has(channelId)) return false;
 channels.add(channelId);

 await Promise.allSettled(Object.values(tasks).map((t) => t(channelId, guildId)));
 return true;
};

export const tasks = {
 pins: async (channelId: string, guildId: string) => {
  if (!guildId) return;

  if (!(await checkPermission(guildId, ['ViewChannel', 'ReadMessageHistory']))) return;

  await cache.pins.delAll(channelId);

  const pins = await api.channels.getPins(channelId).catch(() => []);

  pins.forEach((pin) => {
   cache.pins.set(channelId, pin.id);
   cache.messages.set(pin, guildId!);
  });
 },
};
