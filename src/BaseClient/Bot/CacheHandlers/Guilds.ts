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

import emit from '../../../Util/EventBus.js';
import type { REmoji } from '../CacheClasses/emoji.js';
import type { RSoundboardSound } from '../CacheClasses/soundboard.js';
import type { RSticker } from '../CacheClasses/sticker.js';
import { cache } from '../Client.js';
import RedisClient, { cache as redis } from '../Redis.js';

export default {
 [GatewayDispatchEvents.GuildAuditLogEntryCreate]: (
  data: GatewayGuildAuditLogEntryCreateDispatchData,
 ) => {
  emit(GatewayDispatchEvents.GuildAuditLogEntryCreate, data);
 },

 [GatewayDispatchEvents.GuildBanAdd]: (data: GatewayGuildBanAddDispatchData) => {
  redis.bans.set({ reason: '-', user: data.user }, data.guild_id);
  redis.users.set(data.user);

  emit(
   GatewayDispatchEvents.GuildBanAdd,
   redis.bans.apiToR({ ...data, reason: '-' }, data.guild_id),
  );
 },
 [GatewayDispatchEvents.GuildBanRemove]: async (data: GatewayGuildBanRemoveDispatchData) => {
  redis.bans.del(data.guild_id, data.user.id);
  redis.users.set(data.user);

  emit(
   GatewayDispatchEvents.GuildBanRemove,
   (await redis.bans.get(data.guild_id, data.user.id)) ||
    redis.bans.apiToR({ ...data, reason: '-' }, data.guild_id),
  );
 },

 [GatewayDispatchEvents.GuildCreate]: (data: GatewayGuildCreateDispatchData) => {
  if (data.unavailable) return;
  if ('geo_restricted' in data && data.geo_restricted) return;

  cache.guilds += 1;
  cache.members.set(data.id, data.approximate_member_count || 0);

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

  emit(GatewayDispatchEvents.GuildCreate, redis.guilds.apiToR(data)!);
 },

 [GatewayDispatchEvents.GuildDelete]: async (data: GatewayGuildDeleteDispatchData) => {
  cache.guilds -= 1;
  cache.members.delete(data.id);
  const guild = await redis.guilds.get(data.id);
  redis.guilds.del(data.id);

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

  await deletePipeline.exec();
  emit(GatewayDispatchEvents.GuildDelete, guild!);
 },

 [GatewayDispatchEvents.GuildUpdate]: async (data: GatewayGuildUpdateDispatchData) => {
  emit(GatewayDispatchEvents.GuildUpdate, {
   before: await redis.guilds.get(data.id),
   after: redis.guilds.apiToR(data)!,
  });
  redis.guilds.set(data);
 },

 [GatewayDispatchEvents.GuildEmojisUpdate]: async (data: GatewayGuildEmojisUpdateDispatchData) => {
  const emojis = await RedisClient.hgetall(redis.emojis.keystore(data.guild_id));
  const pipeline = RedisClient.pipeline();
  pipeline.del(...Object.keys(emojis));
  pipeline.del(redis.stickers.keystore(data.guild_id));
  await pipeline.exec();

  data.emojis.forEach((emoji) => redis.emojis.set(emoji, data.guild_id));
  emit(GatewayDispatchEvents.GuildEmojisUpdate, {
   before: Object.values(emojis).map((e) => JSON.parse(e) as REmoji),
   after: data.emojis.map((e) => redis.emojis.apiToR(e, data.guild_id)!),
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
  });
 },

 [GatewayDispatchEvents.GuildIntegrationsUpdate]: async (
  data: GatewayGuildIntegrationsUpdateDispatchData,
 ) => {
  emit(
   GatewayDispatchEvents.GuildIntegrationsUpdate,
   (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
  );
 },

 [GatewayDispatchEvents.GuildMemberAdd]: (data: GatewayGuildMemberAddDispatchData) => {
  cache.members.set(data.guild_id, (cache.members.get(data.guild_id) || 0) + 1);

  redis.members.set(data, data.guild_id);
  redis.users.set(data.user);

  emit(GatewayDispatchEvents.GuildMemberAdd, redis.members.apiToR(data, data.guild_id)!);
 },

 [GatewayDispatchEvents.GuildMemberRemove]: async (data: GatewayGuildMemberRemoveDispatchData) => {
  cache.members.set(data.guild_id, (cache.members.get(data.guild_id) || 0) - 1);

  emit(
   GatewayDispatchEvents.GuildMemberRemove,
   (await redis.members.get(data.guild_id, data.user.id)) || {
    user: redis.users.apiToR(data.user),
    guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
   },
  );

  redis.members.del(data.guild_id, data.user.id);
  redis.users.set(data.user);
 },

 [GatewayDispatchEvents.GuildMembersChunk]: (data: GatewayGuildMembersChunkDispatchData) =>
  data.members.forEach((member) => redis.members.set(member, data.guild_id)),

 [GatewayDispatchEvents.GuildMemberUpdate]: async (data: GatewayGuildMemberUpdateDispatchData) => {
  emit(GatewayDispatchEvents.GuildMemberUpdate, {
   before: await redis.members.get(data.guild_id, data.user.id),
   after: redis.members.apiToR(
    {
     ...data,
     deaf: data.deaf || false,
     mute: data.mute || false,
     flags: data.flags || (0 as GuildMemberFlags),
    },
    data.guild_id,
   )!,
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
  });

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

 [GatewayDispatchEvents.GuildRoleCreate]: async (data: GatewayGuildRoleCreateDispatchData) => {
  await redis.roles.set(data.role, data.guild_id);

  emit(GatewayDispatchEvents.GuildRoleCreate, redis.roles.apiToR(data.role, data.guild_id)!);
 },

 [GatewayDispatchEvents.GuildRoleDelete]: async (data: GatewayGuildRoleCreateDispatchData) => {
  if (data.role) await redis.roles.del(data.role.id);

  emit(GatewayDispatchEvents.GuildRoleDelete, redis.roles.apiToR(data.role, data.guild_id)!);
 },

 [GatewayDispatchEvents.GuildRoleUpdate]: async (data: GatewayGuildRoleCreateDispatchData) => {
  emit(GatewayDispatchEvents.GuildRoleUpdate, {
   before: await redis.roles.get(data.role.id),
   after: redis.roles.apiToR(data.role, data.guild_id)!,
   guild: ((await redis.guilds.get(data.guild_id)) || { id: data.guild_id }) as { id: string },
  });

  redis.roles.set(data.role, data.guild_id);
 },

 [GatewayDispatchEvents.GuildScheduledEventCreate]: (
  data: GatewayGuildScheduledEventCreateDispatchData,
 ) => {
  redis.events.set(data);

  emit(GatewayDispatchEvents.GuildScheduledEventCreate, redis.events.apiToR(data)!);
 },

 [GatewayDispatchEvents.GuildScheduledEventDelete]: (
  data: GatewayGuildScheduledEventDeleteDispatchData,
 ) => {
  redis.events.del(data.id);

  emit(GatewayDispatchEvents.GuildScheduledEventDelete, redis.events.apiToR(data)!);
 },

 [GatewayDispatchEvents.GuildScheduledEventUpdate]: async (
  data: GatewayGuildScheduledEventUpdateDispatchData,
 ) => {
  emit(GatewayDispatchEvents.GuildScheduledEventUpdate, {
   before: await redis.events.get(data.id),
   after: redis.events.apiToR(data)!,
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
  });

  redis.events.set(data);
 },

 [GatewayDispatchEvents.GuildScheduledEventUserAdd]: async (
  data: GatewayGuildScheduledEventUserAddDispatchData,
 ) => {
  emit(GatewayDispatchEvents.GuildScheduledEventUserAdd, {
   event: (await redis.events.get(data.guild_scheduled_event_id)) || {
    id: data.guild_scheduled_event_id,
   },
   user: (await redis.users.get(data.user_id)) || { id: data.user_id },
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
  });
 },

 [GatewayDispatchEvents.GuildScheduledEventUserRemove]: async (
  data: GatewayGuildScheduledEventUserRemoveDispatchData,
 ) => {
  emit(GatewayDispatchEvents.GuildScheduledEventUserRemove, {
   event: (await redis.events.get(data.guild_scheduled_event_id)) || {
    id: data.guild_scheduled_event_id,
   },
   user: (await redis.users.get(data.user_id)) || { id: data.user_id },
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
  });
 },

 [GatewayDispatchEvents.GuildSoundboardSoundCreate]: (
  data: GatewayGuildSoundboardSoundCreateDispatchData,
 ) => {
  if (!data.guild_id) return;

  redis.soundboards.set(data);
  emit(GatewayDispatchEvents.GuildSoundboardSoundCreate, redis.soundboards.apiToR(data)!);
 },

 [GatewayDispatchEvents.GuildSoundboardSoundDelete]: async (
  data: GatewayGuildSoundboardSoundDeleteDispatchData,
 ) => {
  emit(
   GatewayDispatchEvents.GuildSoundboardSoundDelete,
   (await redis.soundboards.get(data.sound_id)) || data,
  );
  redis.soundboards.del(data.sound_id);
 },

 [GatewayDispatchEvents.GuildSoundboardSoundUpdate]: async (
  data: GatewayGuildSoundboardSoundUpdateDispatchData,
 ) => {
  if (!data.guild_id) return;

  emit(GatewayDispatchEvents.GuildSoundboardSoundUpdate, {
   before: await redis.soundboards.get(data.sound_id),
   after: redis.soundboards.apiToR(data)!,
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
  });
  redis.soundboards.set(data);
 },

 [GatewayDispatchEvents.GuildSoundboardSoundsUpdate]: async (
  data: GatewayGuildSoundboardSoundsUpdateDispatchData,
 ) => {
  const sounds = await RedisClient.hgetall(redis.soundboards.keystore(data.guild_id));
  const pipeline = RedisClient.pipeline();
  pipeline.del(...Object.keys(sounds));
  pipeline.del(redis.soundboards.keystore(data.guild_id));
  await pipeline.exec();

  data.soundboard_sounds.forEach((sound) =>
   redis.soundboards.set({ ...sound, guild_id: data.guild_id }),
  );

  emit(GatewayDispatchEvents.GuildSoundboardSoundsUpdate, {
   before: Object.values(sounds).map((s) => JSON.parse(s) as RSoundboardSound),
   after: data.soundboard_sounds.map(
    (s) => redis.soundboards.apiToR({ ...s, guild_id: data.guild_id })!,
   ),
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
  });
 },

 [GatewayDispatchEvents.GuildStickersUpdate]: async (
  data: GatewayGuildStickersUpdateDispatchData,
 ) => {
  const stickers = await RedisClient.hgetall(redis.stickers.keystore(data.guild_id));
  const pipeline = RedisClient.pipeline();
  pipeline.del(...Object.keys(stickers));
  pipeline.del(redis.stickers.keystore(data.guild_id));
  await pipeline.exec();

  data.stickers.forEach((sticker) => redis.stickers.set({ ...sticker, guild_id: data.guild_id }));

  emit(GatewayDispatchEvents.GuildStickersUpdate, {
   before: Object.values(stickers).map((s) => JSON.parse(s) as RSticker),
   after: data.stickers.map((s) => redis.stickers.apiToR({ ...s, guild_id: data.guild_id })!),
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
  });
 },
} as const;
