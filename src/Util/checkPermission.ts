import { PermissionFlagsBits } from 'discord-api-types/v10';

import { cache as clientCache } from '../BaseClient/Bot/Client.js';
import { cache } from '../BaseClient/Bot/Redis.js';

const timeoutDeniedPermissions: ReadonlyArray<bigint> = [
 PermissionFlagsBits.AddReactions,
 PermissionFlagsBits.SendMessages,
 PermissionFlagsBits.ChangeNickname,
 PermissionFlagsBits.Connect,
 PermissionFlagsBits.CreateEvents,
 PermissionFlagsBits.CreateGuildExpressions,
 PermissionFlagsBits.CreatePrivateThreads,
 PermissionFlagsBits.CreatePublicThreads,
 PermissionFlagsBits.DeafenMembers,
 PermissionFlagsBits.KickMembers,
 PermissionFlagsBits.ManageChannels,
 PermissionFlagsBits.ManageEmojisAndStickers,
 PermissionFlagsBits.ManageEvents,
 PermissionFlagsBits.ManageGuild,
 PermissionFlagsBits.ManageGuildExpressions,
 PermissionFlagsBits.ManageMessages,
 PermissionFlagsBits.ManageNicknames,
 PermissionFlagsBits.ManageRoles,
 PermissionFlagsBits.ManageThreads,
 PermissionFlagsBits.ManageWebhooks,
 PermissionFlagsBits.ModerateMembers,
 PermissionFlagsBits.MoveMembers,
 PermissionFlagsBits.MuteMembers,
 PermissionFlagsBits.PinMessages,
 PermissionFlagsBits.SendMessagesInThreads,
 PermissionFlagsBits.UseApplicationCommands,
 PermissionFlagsBits.ViewAuditLog,
] as const;

export default async (
 guildId: string,
 requiredPermissions: (keyof typeof PermissionFlagsBits)[],
 userId: string = clientCache.user?.id || '',
) => {
 if (!requiredPermissions.length) return true;
 if (!userId.length) return false;

 const guild = await cache.guilds.get(guildId);
 if (!guild) return false;
 if (userId === guild.owner_id) return true;

 const member = await cache.members.get(guildId, userId);
 if (!member) return false;

 const everyoneRole = await cache.roles.get(guildId);
 const memberRoles = await Promise.all(member.roles.map((roleId) => cache.roles.get(roleId)));
 const allRoles = [everyoneRole, ...memberRoles].filter((role) => !!role);

 const permissions = allRoles.reduce((acc, role) => BigInt(role.permissions) | acc, 0n);

 if (permissions & BigInt(PermissionFlagsBits.Administrator)) return true;

 if (member.communication_disabled_until) {
  const timeoutEnd = new Date(member.communication_disabled_until).getTime();
  if (timeoutEnd > Date.now()) {
   const requestingDeniedPerm = requiredPermissions.some((perm) =>
    timeoutDeniedPermissions.includes(BigInt(PermissionFlagsBits[perm])),
   );
   if (requestingDeniedPerm) return false;
  }
 }

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
