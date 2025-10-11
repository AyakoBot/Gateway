import {
 GatewayDispatchEvents,
 type APIGuildMember,
 type GatewayGuildAuditLogEntryCreateDispatchData,
 type GatewayGuildBanAddDispatchData,
 type GatewayGuildBanRemoveDispatchData,
 type GatewayGuildCreateDispatchData,
 type GatewayGuildDeleteDispatchData,
 type GatewayGuildEmojisUpdateDispatchData,
 type GatewayGuildIntegrationsUpdateDispatchData,
 type GatewayGuildMemberAddDispatchData,
 type GatewayGuildMemberRemoveDispatchData,
 type GatewayGuildMembersChunkDispatchData,
 type GatewayGuildMemberUpdateDispatchData,
 type GatewayGuildRoleCreateDispatchData,
 type GatewayGuildScheduledEventCreateDispatchData,
 type GatewayGuildScheduledEventDeleteDispatchData,
 type GatewayGuildScheduledEventUpdateDispatchData,
 type GatewayGuildScheduledEventUserAddDispatchData,
 type GatewayGuildScheduledEventUserRemoveDispatchData,
 type GatewayGuildSoundboardSoundCreateDispatchData,
 type GatewayGuildSoundboardSoundDeleteDispatchData,
 type GatewayGuildSoundboardSoundsUpdateDispatchData,
 type GatewayGuildSoundboardSoundUpdateDispatchData,
 type GatewayGuildStickersUpdateDispatchData,
 type GatewayGuildUpdateDispatchData,
 type GuildMemberFlags,
} from 'discord-api-types/v10';

import firstGuildInteraction, { tasks } from '../../../Util/firstGuildInteraction.js';
import { cache } from '../Client.js';
import RedisClient, { cache as redis } from '../Redis.js';

export default {
 [GatewayDispatchEvents.GuildAuditLogEntryCreate]: (
  data: GatewayGuildAuditLogEntryCreateDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  redis.auditlogs.set(data, data.guild_id);
 },

 [GatewayDispatchEvents.GuildBanAdd]: (data: GatewayGuildBanAddDispatchData) => {
  firstGuildInteraction(data.guild_id);
  redis.bans.set({ reason: '-', user: data.user }, data.guild_id);
  redis.users.set(data.user);
 },
 [GatewayDispatchEvents.GuildBanRemove]: (data: GatewayGuildBanRemoveDispatchData) => {
  firstGuildInteraction(data.guild_id);
  redis.bans.del(data.guild_id, data.user.id);
  redis.users.set(data.user);
 },

 [GatewayDispatchEvents.GuildCreate]: (data: GatewayGuildCreateDispatchData) => {
  if (data.unavailable) return;
  if ('geo_restricted' in data && data.geo_restricted) return;

  cache.guilds += 1;
  cache.members.set(data.id, data.member_count || 0);
  cache.emojis.set(data.id, data.emojis?.length || 0);
  cache.roles.set(data.id, data.roles?.length || 0);
  cache.stickers.set(data.id, data.stickers?.length || 0);
  cache.sounds.set(data.id, data.soundboard_sounds?.length || 0);

  redis.guilds.set(data);
  data.soundboard_sounds.forEach((sound) => redis.soundboards.set({ ...sound, guild_id: data.id }));
  data.emojis.forEach((emoji) => redis.emojis.set(emoji, data.id));
  data.threads.forEach((thread) => redis.threads.set({ ...thread, guild_id: data.id }));
  data.guild_scheduled_events.forEach((event) => redis.events.set(event));
  data.roles.forEach((role) => redis.roles.set(role, data.id));
  data.members.forEach((member) => redis.members.set(member, data.id));
  data.members.forEach((member) => redis.users.set(member.user));
  data.voice_states.forEach((voice) => redis.voices.set({ ...voice, guild_id: data.id }));
  data.channels.forEach((channel) => redis.channels.set({ ...channel, guild_id: data.id }));
  data.stickers.forEach((sticker) => redis.stickers.set({ ...sticker, guild_id: data.id }));
 },

 [GatewayDispatchEvents.GuildDelete]: async (data: GatewayGuildDeleteDispatchData) => {
  cache.guilds -= 1;
  cache.members.delete(data.id);
  cache.emojis.delete(data.id);
  cache.roles.delete(data.id);
  cache.stickers.delete(data.id);
  cache.sounds.delete(data.id);

  redis.guilds.del(data.id);
  redis.channelStatuses.delAll(data.id);
  redis.pins.delAll(data.id);

  const getPipeline = RedisClient.pipeline();

  // Add all hgetall commands to the pipeline
  getPipeline.hgetall(redis.automods.keystore(data.id));
  getPipeline.hgetall(redis.bans.keystore(data.id));
  getPipeline.hgetall(redis.channels.keystore(data.id));
  getPipeline.hgetall(redis.commandPermissions.keystore(data.id));
  getPipeline.hgetall(redis.emojis.keystore(data.id));
  getPipeline.hgetall(redis.events.keystore(data.id));
  getPipeline.hgetall(redis.guildCommands.keystore(data.id));
  getPipeline.hgetall(redis.integrations.keystore(data.id));
  getPipeline.hgetall(redis.invites.keystore(data.id));
  getPipeline.hgetall(redis.members.keystore(data.id));
  getPipeline.hgetall(redis.messages.keystore(data.id));
  getPipeline.hgetall(redis.reactions.keystore(data.id));
  getPipeline.hgetall(redis.roles.keystore(data.id));
  getPipeline.hgetall(redis.soundboards.keystore(data.id));
  getPipeline.hgetall(redis.stages.keystore(data.id));
  getPipeline.hgetall(redis.stickers.keystore(data.id));
  getPipeline.hgetall(redis.threads.keystore(data.id));
  getPipeline.hgetall(redis.threadMembers.keystore(data.id));
  getPipeline.hgetall(redis.voices.keystore(data.id));
  getPipeline.hgetall(redis.webhooks.keystore(data.id));
  getPipeline.hgetall(redis.welcomeScreens.keystore(data.id));

  const results = await getPipeline.exec();
  if (!results) return;

  const [
   automods,
   bans,
   channels,
   commandPermissions,
   emojis,
   events,
   guildCommands,
   integrations,
   invites,
   members,
   messages,
   reactions,
   roles,
   soundboards,
   stages,
   stickers,
   threads,
   threadMembers,
   voices,
   webhooks,
   welcomeScreens,
  ] = results.map((result) => result[1] || {});

  const deletePipeline = RedisClient.pipeline();
  deletePipeline.del(redis.guilds.keystore(data.id));
  deletePipeline.del(redis.automods.keystore(data.id));
  deletePipeline.del(redis.bans.keystore(data.id));
  deletePipeline.del(redis.channels.keystore(data.id));
  deletePipeline.del(redis.commandPermissions.keystore(data.id));
  deletePipeline.del(redis.emojis.keystore(data.id));
  deletePipeline.del(redis.events.keystore(data.id));
  deletePipeline.del(redis.guildCommands.keystore(data.id));
  deletePipeline.del(redis.integrations.keystore(data.id));
  deletePipeline.del(redis.invites.keystore(data.id));
  deletePipeline.del(redis.members.keystore(data.id));
  deletePipeline.del(redis.messages.keystore(data.id));
  deletePipeline.del(redis.reactions.keystore(data.id));
  deletePipeline.del(redis.roles.keystore(data.id));
  deletePipeline.del(redis.soundboards.keystore(data.id));
  deletePipeline.del(redis.stages.keystore(data.id));
  deletePipeline.del(redis.stickers.keystore(data.id));
  deletePipeline.del(redis.threads.keystore(data.id));
  deletePipeline.del(redis.threadMembers.keystore(data.id));
  deletePipeline.del(redis.voices.keystore(data.id));
  deletePipeline.del(redis.webhooks.keystore(data.id));
  deletePipeline.del(redis.welcomeScreens.keystore(data.id));

  deletePipeline.del(...Object.keys(automods));
  deletePipeline.del(...Object.keys(bans));
  deletePipeline.del(...Object.keys(channels));
  deletePipeline.del(...Object.keys(commandPermissions));
  deletePipeline.del(...Object.keys(emojis));
  deletePipeline.del(...Object.keys(events));
  deletePipeline.del(...Object.keys(guildCommands));
  deletePipeline.del(...Object.keys(integrations));
  deletePipeline.del(...Object.keys(invites));
  deletePipeline.del(...Object.keys(members));
  deletePipeline.del(...Object.keys(messages));
  deletePipeline.del(...Object.keys(reactions));
  deletePipeline.del(...Object.keys(roles));
  deletePipeline.del(...Object.keys(soundboards));
  deletePipeline.del(...Object.keys(stages));
  deletePipeline.del(...Object.keys(stickers));
  deletePipeline.del(...Object.keys(threads));
  deletePipeline.del(...Object.keys(threadMembers));
  deletePipeline.del(...Object.keys(voices));
  deletePipeline.del(...Object.keys(webhooks));
  deletePipeline.del(...Object.keys(welcomeScreens));

  await deletePipeline.exec();
 },

 [GatewayDispatchEvents.GuildUpdate]: (data: GatewayGuildUpdateDispatchData) => {
  firstGuildInteraction(data.id);
  redis.guilds.set(data);
 },

 [GatewayDispatchEvents.GuildEmojisUpdate]: async (data: GatewayGuildEmojisUpdateDispatchData) => {
  firstGuildInteraction(data.guild_id);
  cache.emojis.set(data.guild_id, data.emojis.length);

  const emojis = await RedisClient.hgetall(redis.emojis.keystore(data.guild_id));
  const pipeline = RedisClient.pipeline();
  pipeline.del(...Object.keys(emojis));
  pipeline.del(redis.emojis.keystore(data.guild_id));
  await pipeline.exec();

  data.emojis.forEach((emoji) => redis.emojis.set(emoji, data.guild_id));
 },

 [GatewayDispatchEvents.GuildIntegrationsUpdate]: async (
  data: GatewayGuildIntegrationsUpdateDispatchData,
 ) => {
  const success = await firstGuildInteraction(data.guild_id);
  if (success) return;

  tasks.integrations(data.guild_id);
 },

 [GatewayDispatchEvents.GuildMemberAdd]: (data: GatewayGuildMemberAddDispatchData) => {
  firstGuildInteraction(data.guild_id);
  cache.members.set(data.guild_id, (cache.members.get(data.guild_id) || 0) + 1);

  redis.members.set(data, data.guild_id);
  redis.users.set(data.user);
 },

 [GatewayDispatchEvents.GuildMemberRemove]: (data: GatewayGuildMemberRemoveDispatchData) => {
  firstGuildInteraction(data.guild_id);
  cache.members.set(data.guild_id, (cache.members.get(data.guild_id) || 0) - 1);

  redis.members.del(data.guild_id, data.user.id);
  redis.users.set(data.user);
 },

 [GatewayDispatchEvents.GuildMembersChunk]: (data: GatewayGuildMembersChunkDispatchData) => {
  firstGuildInteraction(data.guild_id);
  data.members.forEach((member) => redis.members.set(member, data.guild_id));
 },

 [GatewayDispatchEvents.GuildMemberUpdate]: async (data: GatewayGuildMemberUpdateDispatchData) => {
  firstGuildInteraction(data.guild_id);

  if (data.joined_at && data.deaf && data.mute) {
   redis.members.set(data as Parameters<typeof redis.members.set>[0], data.guild_id);
   return;
  }

  const member = await RedisClient.get(
   `${redis.members.key()}:${data.guild_id}:${data.user.id}`,
  ).then((r) => (r ? (JSON.parse(r) as APIGuildMember) : null));
  if (!member) {
   redis.members.set(
    {
     ...data,
     joined_at: data.joined_at || new Date().toISOString(),
     mute: data.mute || false,
     deaf: data.deaf || false,
     flags: data.flags || (0 as GuildMemberFlags),
    },
    data.guild_id,
   );
   return;
  }

  const mergedMember = { ...data };

  if (!data.user) return;
  redis.members.set(
   {
    ...mergedMember,
    deaf: mergedMember.deaf || false,
    mute: mergedMember.mute || false,
    flags: mergedMember.flags || (0 as GuildMemberFlags),
    joined_at: mergedMember.joined_at || new Date().toISOString(),
   },
   data.guild_id,
  );
 },

 [GatewayDispatchEvents.GuildRoleCreate]: (data: GatewayGuildRoleCreateDispatchData) => {
  firstGuildInteraction(data.guild_id);
  cache.roles.set(data.guild_id, (cache.roles.get(data.guild_id) || 1) + 1);

  redis.roles.set(data.role, data.guild_id);
 },

 [GatewayDispatchEvents.GuildRoleDelete]: (data: GatewayGuildRoleCreateDispatchData) => {
  firstGuildInteraction(data.guild_id);
  cache.roles.set(data.guild_id, (cache.roles.get(data.guild_id) || 1) - 1);

  if (data.role) redis.roles.del(data.role.id);
 },

 [GatewayDispatchEvents.GuildRoleUpdate]: (data: GatewayGuildRoleCreateDispatchData) => {
  firstGuildInteraction(data.guild_id);
  redis.roles.set(data.role, data.guild_id);
 },

 [GatewayDispatchEvents.GuildScheduledEventCreate]: (
  data: GatewayGuildScheduledEventCreateDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  redis.events.set(data);
 },

 [GatewayDispatchEvents.GuildScheduledEventDelete]: (
  data: GatewayGuildScheduledEventDeleteDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  redis.events.del(data.id);
 },

 [GatewayDispatchEvents.GuildScheduledEventUpdate]: (
  data: GatewayGuildScheduledEventUpdateDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  redis.events.set(data);
 },

 [GatewayDispatchEvents.GuildScheduledEventUserAdd]: (
  data: GatewayGuildScheduledEventUserAddDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
 },

 [GatewayDispatchEvents.GuildScheduledEventUserRemove]: (
  data: GatewayGuildScheduledEventUserRemoveDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
 },

 [GatewayDispatchEvents.GuildSoundboardSoundCreate]: (
  data: GatewayGuildSoundboardSoundCreateDispatchData,
 ) => {
  if (!data.guild_id) return;
  firstGuildInteraction(data.guild_id);

  cache.sounds.set(data.guild_id, (cache.sounds.get(data.guild_id) || 0) + 1);

  redis.soundboards.set(data);
 },

 [GatewayDispatchEvents.GuildSoundboardSoundDelete]: (
  data: GatewayGuildSoundboardSoundDeleteDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  cache.sounds.set(data.guild_id, (cache.sounds.get(data.guild_id) || 1) - 1);

  redis.soundboards.del(data.sound_id);
 },

 [GatewayDispatchEvents.GuildSoundboardSoundUpdate]: (
  data: GatewayGuildSoundboardSoundUpdateDispatchData,
 ) => {
  if (!data.guild_id) return;
  firstGuildInteraction(data.guild_id);

  redis.soundboards.set(data);
 },

 [GatewayDispatchEvents.GuildSoundboardSoundsUpdate]: async (
  data: GatewayGuildSoundboardSoundsUpdateDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  cache.sounds.set(data.guild_id, data.soundboard_sounds.length);

  const sounds = await RedisClient.hgetall(redis.soundboards.keystore(data.guild_id));
  const pipeline = RedisClient.pipeline();
  pipeline.del(...Object.keys(sounds));
  pipeline.del(redis.soundboards.keystore(data.guild_id));
  await pipeline.exec();

  data.soundboard_sounds.forEach((sound) =>
   redis.soundboards.set({ ...sound, guild_id: data.guild_id }),
  );
 },

 [GatewayDispatchEvents.GuildStickersUpdate]: async (
  data: GatewayGuildStickersUpdateDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  cache.stickers.set(data.guild_id, data.stickers.length);

  const stickers = await RedisClient.hgetall(redis.stickers.keystore(data.guild_id));
  const pipeline = RedisClient.pipeline();
  pipeline.del(...Object.keys(stickers));
  pipeline.del(redis.stickers.keystore(data.guild_id));
  await pipeline.exec();

  data.stickers.forEach((sticker) => redis.stickers.set({ ...sticker, guild_id: data.guild_id }));
 },
} as const;
