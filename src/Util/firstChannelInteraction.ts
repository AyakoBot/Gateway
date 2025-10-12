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

  const pins = await api.channels.getPins(channelId).catch(() => []);

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

  // Filter to only invites for this specific channel
  const channelInvitePrefix = cache.invites.key(channelId);
  const channelKeys = allKeys.filter((key) => key.startsWith(channelInvitePrefix));

  const inviteCodes = channelKeys.map((key) => {
   const parts = key.split(':');
   return parts[parts.length - 2];
  });

  const guildCodestoreKey = cache.invites.codestore(guildId);
  const globalCodestoreKey = cache.invites.codestore();

  if (channelKeys.length > 0) await RedisClient.del(...channelKeys);
  if (inviteCodes.length > 0) {
   await RedisClient.hdel(guildCodestoreKey, ...inviteCodes);
   await RedisClient.hdel(globalCodestoreKey, ...inviteCodes);
  }

  const invites = await api.channels.getInvites(channelId).catch(() => []);
  invites.forEach((invite) => cache.invites.set(invite));
 },
};
