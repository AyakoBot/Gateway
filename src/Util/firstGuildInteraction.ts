import { GuildFeature } from 'discord-api-types/v10';

import { api, cache as clientCache } from '../BaseClient/Bot/Client.js';
import { cache } from '../BaseClient/Bot/Redis.js';

import checkPermission from './checkPermission.js';
import requestGuildMembers from './requestGuildMembers.js';
import requestVoiceChannelStatuses from './requestVoiceChannelStatuses.js';

const guilds = new Set<string>();

// TODO: delete all existing
export default async (guildId: string) => {
 if (guilds.has(guildId)) return false;
 guilds.add(guildId);

 Object.values(tasks).forEach((t) => t(guildId));
 return true;
};

export const tasks = {
 vcStatus: (guildId: string) => requestVoiceChannelStatuses(guildId),
 autoModRules: async (guildId: string) => {
  if (!(await checkPermission(guildId, ['ManageGuild']))) return;

  const rules = await api.guilds.getAutoModerationRules(guildId);
  rules.forEach((r) => cache.automods.set(r));
 },
 commands: async (guildId: string) => {
  if (!clientCache.user) return;

  api.applicationCommands.getGuildCommands(clientCache.user.id, guildId);
 },
 members: async (guildId: string) => requestGuildMembers(guildId),
 commandPermissions: async (guildId: string) => {
  if (!clientCache.user) return;

  const commandPerms = await api.applicationCommands.getGuildCommandsPermissions(
   clientCache.user.id,
   guildId,
  );

  commandPerms.forEach((command) =>
   command.permissions.forEach((perm) => cache.commandPermissions.set(perm, guildId, command.id)),
  );
 },

 welcomeScreen: async (guildId: string) => {
  const guild = await cache.guilds.get(guildId);
  if (!guild) return;

  if (
   !guild.features.includes(GuildFeature.WelcomeScreenEnabled) &&
   !(await checkPermission(guildId, ['ManageGuild']))
  ) {
   return;
  }

  const welcomeScreen = await api.guilds.getWelcomeScreen(guildId);
  if (!welcomeScreen) return;

  cache.welcomeScreens.set(welcomeScreen, guildId);
 },
 scheduledEvents: async (guildId: string) => {
  const scheduledEvents = await api.guilds.getScheduledEvents(guildId, { with_user_count: true });
  scheduledEvents.forEach((e) => cache.events.set(e));
 },
 webhooks: async (guildId: string) => {
  if (!(await checkPermission(guildId, ['ManageWebhooks']))) return;

  const webhooks = await api.guilds.getWebhooks(guildId);
  webhooks.forEach((w) => cache.webhooks.set(w));
 },
 integrations: async (guildId: string) => {
  if (!(await checkPermission(guildId, ['ManageGuild']))) return;

  const integrations = await api.guilds.getIntegrations(guildId);
  integrations.forEach((i) => cache.integrations.set(i, guildId));
 },
 invites: async (guildId: string) => {
  let hasPerms = await checkPermission(guildId, ['ManageGuild']);
  if (!hasPerms) hasPerms = await checkPermission(guildId, ['ViewAuditLog']);
  if (!hasPerms) return;

  const invites = await api.guilds.getInvites(guildId);
  invites.forEach((i) => cache.invites.set(i));
 },
};
