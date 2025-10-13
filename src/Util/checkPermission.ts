import { PermissionFlagsBits } from 'discord-api-types/v10';

import { cache as clientCache } from '../BaseClient/Bot/Client.js';
import { cache } from '../BaseClient/Bot/Redis.js';

export default async (
 guildId: string,
 requiredPermissions: (keyof typeof PermissionFlagsBits)[],
 userId: string = clientCache.user?.id || '',
) => {
 if (!requiredPermissions.length) return true;
 if (!userId.length) return false;

 const member = await cache.members.get(guildId, userId);
 if (!member) return false;

 const roles = await Promise.all(member.roles.map((roleId) => cache.roles.get(roleId)));
 const permissions = roles.reduce((acc, role) => BigInt(role?.permissions || '0') | acc, 0n);

 if (permissions & BigInt(PermissionFlagsBits.Administrator)) return true;

 if (
  !requiredPermissions.every(
   (perm) =>
    (permissions & BigInt(PermissionFlagsBits[perm])) === BigInt(PermissionFlagsBits[perm]),
  )
 ) {
  return false;
 }

 return true;
};
