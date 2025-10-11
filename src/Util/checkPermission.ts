import { PermissionFlagsBits } from 'discord-api-types/v10';
import { cache as clientCache } from 'src/BaseClient/Bot/Client.js';
import { cache } from 'src/BaseClient/Bot/Redis.js';

export default async (
 guildId: string,
 requiredPermissions: (keyof typeof PermissionFlagsBits)[],
) => {
 if (!requiredPermissions.length) return true;
 if (!clientCache.user) return false;

 const me = await cache.members.get(guildId, clientCache.user.id);
 if (!me) return false;

 const roles = await Promise.all(me.roles.map((roleId) => cache.roles.get(roleId)));
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
