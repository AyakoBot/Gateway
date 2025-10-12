import { api } from '../BaseClient/Bot/Client.js';
import RedisClient, { cache } from '../BaseClient/Bot/Redis.js';

import checkPermission from './checkPermission.js';

const channels = new Set<string>();

export default async (channelId: string, guildId: string) => {
 if (!channelId) return false;

 if (channels.has(channelId)) return false;
 channels.add(channelId);

 Object.values(tasks).forEach((t) => t(channelId, guildId));
 return true;
};

export const tasks = {
 pins: async (channelId: string, guildId: string) => {
  if (!guildId) return;

  if (!(await checkPermission(guildId, ['ViewChannel']))) return;

  await cache.pins.delAll(channelId);

  const pins = await api.channels.getPins(channelId);

  pins.forEach((pin) => {
   cache.pins.set(channelId, pin.id);
   cache.messages.set(pin, guildId!);
  });
 },
 invites: async (channelId: string, guildId: string) => {
  if (!guildId) return;
  if (!(await checkPermission(guildId, ['ManageChannels']))) return;

  const keystoreKey = cache.invites.keystore(guildId);
  const allKeys = await RedisClient.hkeys(keystoreKey);

  const channelInvitePrefix = cache.invites.key(channelId);
  const channelKeys = allKeys.filter((key) => key.startsWith(channelInvitePrefix));
  if (channelKeys.length > 0) await RedisClient.del(...channelKeys);

  const invites = await api.channels.getInvites(channelId);
  invites.forEach((invite) => cache.invites.set(invite));
 },
};
