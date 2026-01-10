import { GuildFeature } from 'discord-api-types/v10';

import { api, cache as clientCache } from '../BaseClient/Bot/Client.js';
import RedisClient, { cache } from '../BaseClient/Bot/Redis.js';

import checkPermission from './checkPermission.js';
import requestEventSubscribers from './requestEventSubscribers.js';
import requestGuildMembers from './requestGuildMembers.js';
import requestVoiceChannelStatuses from './requestVoiceChannelStatuses.js';

export default async (guildId: string) => {
 const pipeline = RedisClient.pipeline();
 pipeline.hget('guild-interacts', guildId);
 pipeline.hset('guild-interacts', guildId, '1');
 pipeline.call('hexpire', 'guild-interacts', 604800, 'NX', 'FIELDS', 1, guildId);

 const [isMember] = await pipeline.exec().then((res) => (res || [])?.map((r) => r[1]));
 if (isMember === '1') return false;

 await Promise.allSettled(Object.values(tasks).map((t) => t(guildId)));
 return true;
};

export const tasks = {
 vcStatus: (guildId: string) => requestVoiceChannelStatuses(guildId),
 autoModRules: async (guildId: string) => {
  if (!(await checkPermission(guildId, ['ManageGuild']))) return;

  const keystoreKey = cache.automods.keystore(guildId);
  const keys = await RedisClient.hkeys(keystoreKey);
  if (keys.length > 0) await RedisClient.del(...keys, keystoreKey);

  const rules = await api.guilds.getAutoModerationRules(guildId).catch(() => []);
  rules.forEach((r) => cache.automods.set(r));
 },
 commands: async (guildId: string) => {
  if (!clientCache.user) return;

  const keystoreKey = cache.commands.keystore(guildId);
  const keys = await RedisClient.hkeys(keystoreKey);
  if (keys.length > 0) await RedisClient.del(...keys, keystoreKey);

  const commands = await api.applicationCommands
   .getGuildCommands(clientCache.user.id, guildId)
   .catch(() => []);
  commands.forEach((c) => cache.guildCommands.set({ ...c, guild_id: guildId }));
 },
 members: async (guildId: string) => requestGuildMembers(guildId),
 commandPermissions: async (guildId: string) => {
  if (!clientCache.user) return;

  const keystoreKey = cache.commandPermissions.keystore(guildId);
  const keys = await RedisClient.hkeys(keystoreKey);
  if (keys.length > 0) await RedisClient.del(...keys, keystoreKey);

  const commandPerms = await api.applicationCommands
   .getGuildCommandsPermissions(clientCache.user.id, guildId)
   .catch(() => []);

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

  const keystoreKey = cache.welcomeScreens.keystore(guildId);
  const keys = await RedisClient.hkeys(keystoreKey);
  if (keys.length > 0) await RedisClient.del(...keys, keystoreKey);

  const welcomeScreen = await api.guilds.getWelcomeScreen(guildId).catch(() => null);
  if (!welcomeScreen) return;

  cache.welcomeScreens.set(welcomeScreen, guildId);
 },
 onboarding: async (guildId: string) => {
  const guild = await cache.guilds.get(guildId);
  if (!guild) return;

  if (!(await checkPermission(guildId, ['ManageGuild']))) return;

  const onboarding = await api.guilds.getOnboarding(guildId);
  cache.onboardings.set(onboarding);
 },
 scheduledEvents: async (guildId: string) => {
  const keystoreKey = cache.events.keystore(guildId);
  const keys = await RedisClient.hkeys(keystoreKey);
  if (keys.length > 0) await RedisClient.del(...keys, keystoreKey);

  const scheduledEvents = await api.guilds
   .getScheduledEvents(guildId, { with_user_count: true })
   .catch(() => []);
  scheduledEvents.forEach((e) => cache.events.set(e));

  const members = (
   await Promise.all(scheduledEvents.map((e) => requestEventSubscribers(e)))
  ).flat();

  members.forEach((u) => {
   cache.users.set(u.user);
   cache.eventUsers.set(
    {
     guild_id: guildId,
     guild_scheduled_event_id: u.guildScheduledEventId,
     user: u.user,
     user_id: u.user.id,
     member: u.member,
    },
    guildId,
   );

   if (u.member) cache.members.set(u.member, guildId);
  });
 },
 webhooks: async (guildId: string) => {
  if (!(await checkPermission(guildId, ['ManageWebhooks']))) return;

  const keystoreKey = cache.webhooks.keystore(guildId);
  const keys = await RedisClient.hkeys(keystoreKey);
  if (keys.length > 0) await RedisClient.del(...keys, keystoreKey);

  const webhooks = await api.guilds.getWebhooks(guildId).catch(() => []);
  webhooks.forEach((w) => cache.webhooks.set(w));
 },
 integrations: async (guildId: string) => {
  if (!(await checkPermission(guildId, ['ManageGuild']))) return;

  const keystoreKey = cache.integrations.keystore(guildId);
  const keys = await RedisClient.hkeys(keystoreKey);
  if (keys.length > 0) await RedisClient.del(...keys, keystoreKey);

  const integrations = await api.guilds.getIntegrations(guildId).catch(() => []);
  integrations.forEach((i) => cache.integrations.set(i, guildId));
 },
 invites: async (guildId: string) => {
  let hasPerms = await checkPermission(guildId, ['ManageGuild']);
  if (!hasPerms) hasPerms = await checkPermission(guildId, ['ViewAuditLog']);
  if (!hasPerms) return;

  const keystoreKey = cache.invites.keystore(guildId);
  const keys = await RedisClient.hkeys(keystoreKey);
  const guildCodestoreKey = cache.invites.codestore(guildId);
  const globalCodestoreKey = cache.invites.codestore();

  const codes = await RedisClient.hkeys(guildCodestoreKey);

  if (keys.length > 0) await RedisClient.del(...keys, keystoreKey, guildCodestoreKey);
  if (codes.length > 0) await RedisClient.hdel(globalCodestoreKey, ...codes);

  const invites = await api.guilds.getInvites(guildId).catch(() => []);
  invites.forEach((i) => cache.invites.set(i));
 },
};
