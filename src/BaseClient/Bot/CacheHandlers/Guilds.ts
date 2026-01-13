import {
 GatewayDispatchEvents,
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
 type GatewayGuildRoleDeleteDispatchData,
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
import redis from '../Cache.js';
import { cache } from '../Client.js';

export default {
 [GatewayDispatchEvents.GuildAuditLogEntryCreate]: async (
  data: GatewayGuildAuditLogEntryCreateDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  redis.audits.set(data, data.guild_id);
 },

 [GatewayDispatchEvents.GuildBanAdd]: async (data: GatewayGuildBanAddDispatchData) => {
  firstGuildInteraction(data.guild_id);
  redis.bans.set({ reason: '-', user: data.user }, data.guild_id);
  redis.users.set(data.user);
 },
 [GatewayDispatchEvents.GuildBanRemove]: async (data: GatewayGuildBanRemoveDispatchData) => {
  firstGuildInteraction(data.guild_id);
  redis.bans.del(data.guild_id, data.user.id);
  redis.users.set(data.user);
 },

 [GatewayDispatchEvents.GuildCreate]: async (data: GatewayGuildCreateDispatchData) => {
  if (data.unavailable) return;
  if ('geo_restricted' in data && data.geo_restricted) return;

  const guildId = data.id;

  cache.guilds += 1;
  cache.members.set(guildId, data.member_count || 0);
  cache.emojis.set(guildId, data.emojis?.length || 0);
  cache.roles.set(guildId, data.roles?.length || 0);
  cache.stickers.set(guildId, data.stickers?.length || 0);
  cache.sounds.set(guildId, data.soundboard_sounds?.length || 0);

  const CHUNK_SIZE = 500;

  const rGuild = redis.guilds.apiToR(data);
  if (rGuild) {
   const p1 = redis.cacheDb.pipeline();
   p1.set(`cache:guilds:${guildId}:current`, JSON.stringify(rGuild), 'EX', 604800);
   p1.hset('keystore:guilds', `cache:guilds:${guildId}`, 0);
   await p1.exec();
  }

  const { members } = data;
  (data as { members?: unknown }).members = undefined;
  for (let i = 0; i < members.length; i += CHUNK_SIZE) {
   const chunk = members.slice(i, i + CHUNK_SIZE);
   const pipeline = redis.cacheDb.pipeline();
   chunk.forEach((member) => {
    if (!member.user) return;
    const rMember = redis.members.apiToR(member, guildId);
    if (rMember) {
     pipeline.set(
      `cache:members:${guildId}:${member.user.id}:current`,
      JSON.stringify(rMember),
      'EX',
      604800,
     );
     pipeline.hset(`keystore:members:${guildId}`, `cache:members:${guildId}:${member.user.id}`, 0);
    }
    const rUser = redis.users.apiToR(member.user);
    if (rUser) {
     pipeline.set(`cache:users:${member.user.id}:current`, JSON.stringify(rUser), 'EX', 604800);
    }
   });
   await pipeline.exec();
  }

  const { channels } = data;
  (data as { channels?: unknown }).channels = undefined;
  for (let i = 0; i < channels.length; i += CHUNK_SIZE) {
   const chunk = channels.slice(i, i + CHUNK_SIZE);
   const pipeline = redis.cacheDb.pipeline();
   chunk.forEach((channel) => {
    const rChannel = redis.channels.apiToR({ ...channel, guild_id: guildId });
    if (rChannel) {
     pipeline.set(`cache:channels:${channel.id}:current`, JSON.stringify(rChannel), 'EX', 604800);
     pipeline.hset(`keystore:channels:${guildId}`, `cache:channels:${channel.id}`, 0);
    }
   });
   await pipeline.exec();
  }

  const { roles } = data;
  (data as { roles?: unknown }).roles = undefined;
  const rolesPipeline = redis.cacheDb.pipeline();
  roles.forEach((role) => {
   const rRole = redis.roles.apiToR(role, guildId);
   if (rRole) {
    rolesPipeline.set(`cache:roles:${role.id}:current`, JSON.stringify(rRole), 'EX', 604800);
    rolesPipeline.hset(`keystore:roles:${guildId}`, `cache:roles:${role.id}`, 0);
   }
  });
  await rolesPipeline.exec();

  const miscPipeline = redis.cacheDb.pipeline();

  const { emojis } = data;
  (data as { emojis?: unknown }).emojis = undefined;
  emojis.forEach((emoji) => {
   if (!emoji.id) return;
   const rEmoji = redis.emojis.apiToR(emoji, guildId);
   if (rEmoji) {
    miscPipeline.set(`cache:emojis:${emoji.id}:current`, JSON.stringify(rEmoji), 'EX', 604800);
    miscPipeline.hset(`keystore:emojis:${guildId}`, `cache:emojis:${emoji.id}`, 0);
   }
  });

  const { stickers } = data;
  (data as { stickers?: unknown }).stickers = undefined;
  stickers.forEach((sticker) => {
   const rSticker = redis.stickers.apiToR({ ...sticker, guild_id: guildId });
   if (rSticker) {
    miscPipeline.set(
     `cache:stickers:${sticker.id}:current`,
     JSON.stringify(rSticker),
     'EX',
     604800,
    );
    miscPipeline.hset(`keystore:stickers:${guildId}`, `cache:stickers:${sticker.id}`, 0);
   }
  });

  const { soundboard_sounds: sounds } = data;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  (data as { soundboard_sounds?: unknown }).soundboard_sounds = undefined;
  sounds.forEach((sound) => {
   const rSound = redis.soundboards.apiToR({ ...sound, guild_id: guildId });
   if (rSound) {
    miscPipeline.set(
     `cache:soundboards:${sound.sound_id}:current`,
     JSON.stringify(rSound),
     'EX',
     604800,
    );
   }
  });

  const { voice_states: voiceStates } = data;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  (data as { voice_states?: unknown }).voice_states = undefined;
  voiceStates.forEach((voice) => {
   if (!voice.user_id) return;
   const rVoice = redis.voices.apiToR({ ...voice, guild_id: guildId });
   if (rVoice) {
    miscPipeline.set(
     `cache:voices:${guildId}:${voice.user_id}:current`,
     JSON.stringify(rVoice),
     'EX',
     604800,
    );
    miscPipeline.hset(`keystore:voices:${guildId}`, `cache:voices:${guildId}:${voice.user_id}`, 0);
   }
  });

  const { threads } = data;
  (data as { threads?: unknown }).threads = undefined;
  threads.forEach((thread) => {
   const rThread = redis.threads.apiToR({ ...thread, guild_id: guildId });
   if (rThread) {
    miscPipeline.set(`cache:threads:${thread.id}:current`, JSON.stringify(rThread), 'EX', 604800);
    miscPipeline.hset(`keystore:threads:${guildId}`, `cache:threads:${thread.id}`, 0);
   }
  });

  const { guild_scheduled_events: events } = data;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  (data as { guild_scheduled_events?: unknown }).guild_scheduled_events = undefined;
  events.forEach((event) => {
   const rEvent = redis.events.apiToR(event);
   if (rEvent) {
    miscPipeline.set(`cache:events:${event.id}:current`, JSON.stringify(rEvent), 'EX', 604800);
    miscPipeline.hset(`keystore:events:${event.guild_id}`, `cache:events:${event.id}`, 0);
   }
  });

  await miscPipeline.exec();
 },

 [GatewayDispatchEvents.GuildDelete]: async (data: GatewayGuildDeleteDispatchData) => {
  cache.guilds -= 1;
  cache.members.delete(data.id);
  cache.emojis.delete(data.id);
  cache.roles.delete(data.id);
  cache.stickers.delete(data.id);
  cache.sounds.delete(data.id);

  redis.guilds.del(data.id);
  redis.channelStatus.delAll(data.id);
  redis.pins.delAll(data.id);

  const getPipeline = redis.cacheDb.pipeline();

  getPipeline.hgetall(redis.audits.keystore(data.id));
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
  getPipeline.hgetall(redis.onboardings.keystore(data.id));
  getPipeline.hgetall(redis.eventUsers.keystore(data.id));

  const results = await getPipeline.exec();
  if (!results) return;

  const [
   auditlogs,
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
   onboarding,
   eventUsers,
  ] = results.map((result) => result[1] || {});

  const deletePipeline = redis.cacheDb.pipeline();
  deletePipeline.del(redis.guilds.keystore(data.id));
  deletePipeline.del(redis.audits.keystore(data.id));
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
  deletePipeline.del(redis.onboardings.keystore(data.id));
  deletePipeline.del(redis.eventUsers.keystore(data.id));

  deletePipeline.del(...Object.keys(auditlogs));
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
  deletePipeline.del(...Object.keys(onboarding));
  deletePipeline.del(...Object.keys(eventUsers));

  await deletePipeline.exec();
 },

 [GatewayDispatchEvents.GuildUpdate]: async (data: GatewayGuildUpdateDispatchData) => {
  firstGuildInteraction(data.id);
  redis.guilds.set(data);
 },

 [GatewayDispatchEvents.GuildEmojisUpdate]: async (data: GatewayGuildEmojisUpdateDispatchData) => {
  firstGuildInteraction(data.guild_id);
  cache.emojis.set(data.guild_id, data.emojis.length);

  const emojis = await redis.cacheDb.hgetall(redis.emojis.keystore(data.guild_id));
  const pipeline = redis.cacheDb.pipeline();
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

 [GatewayDispatchEvents.GuildMemberAdd]: async (data: GatewayGuildMemberAddDispatchData) => {
  firstGuildInteraction(data.guild_id);
  cache.members.set(data.guild_id, (cache.members.get(data.guild_id) || 0) + 1);

  redis.members.set(data, data.guild_id);
  redis.users.set(data.user);
 },

 [GatewayDispatchEvents.GuildMemberRemove]: async (data: GatewayGuildMemberRemoveDispatchData) => {
  firstGuildInteraction(data.guild_id);
  cache.members.set(data.guild_id, (cache.members.get(data.guild_id) || 0) - 1);

  redis.members.del(data.guild_id, data.user.id);
  redis.users.set(data.user);
 },

 [GatewayDispatchEvents.GuildMembersChunk]: async (data: GatewayGuildMembersChunkDispatchData) => {
  if (data.chunk_count === data.chunk_index + 1) {
   // eslint-disable-next-line no-console
   console.log('[Chunk] Finished receiving member chunks for', data.guild_id);

   cache.requestingGuild = null;
  }

  if (data.chunk_index === 0) {
   // eslint-disable-next-line no-console
   console.log('[Chunk] Receiving', data.chunk_count, 'member chunks for', data.guild_id);

   const keystoreKey = redis.members.keystore(data.guild_id);
   const keys = await redis.cacheDb.hkeys(keystoreKey);
   if (keys.length > 0) {
    const pipeline = redis.cacheDb.pipeline();
    keys.forEach((key) => pipeline.del(key));
    pipeline.del(keystoreKey);
    await pipeline.exec();
   }
  }

  await redis.members.setMany(data.members, data.guild_id);
 },

 [GatewayDispatchEvents.GuildMemberUpdate]: async (data: GatewayGuildMemberUpdateDispatchData) => {
  firstGuildInteraction(data.guild_id);

  if (data.joined_at && data.deaf && data.mute) {
   redis.members.set(data as Parameters<typeof redis.members.set>[0], data.guild_id);
   return;
  }

  const member = await redis.members.get(data.guild_id, data.user.id);
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
  firstGuildInteraction(data.guild_id);
  cache.roles.set(data.guild_id, (cache.roles.get(data.guild_id) || 1) + 1);

  redis.roles.set(data.role, data.guild_id);
 },

 [GatewayDispatchEvents.GuildRoleDelete]: async (data: GatewayGuildRoleDeleteDispatchData) => {
  firstGuildInteraction(data.guild_id);
  cache.roles.set(data.guild_id, (cache.roles.get(data.guild_id) || 1) - 1);

  redis.roles.del(data.role_id);
 },

 [GatewayDispatchEvents.GuildRoleUpdate]: async (data: GatewayGuildRoleCreateDispatchData) => {
  firstGuildInteraction(data.guild_id);
  redis.roles.set(data.role, data.guild_id);
 },

 [GatewayDispatchEvents.GuildScheduledEventCreate]: async (
  data: GatewayGuildScheduledEventCreateDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  redis.events.set(data);
 },

 [GatewayDispatchEvents.GuildScheduledEventDelete]: async (
  data: GatewayGuildScheduledEventDeleteDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  redis.events.del(data.id);
 },

 [GatewayDispatchEvents.GuildScheduledEventUpdate]: async (
  data: GatewayGuildScheduledEventUpdateDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  redis.events.set(data);
 },

 [GatewayDispatchEvents.GuildScheduledEventUserAdd]: async (
  data: GatewayGuildScheduledEventUserAddDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);

  redis.eventUsers.set(data, data.guild_id);
 },

 [GatewayDispatchEvents.GuildScheduledEventUserRemove]: async (
  data: GatewayGuildScheduledEventUserRemoveDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);

  redis.eventUsers.del(data.guild_scheduled_event_id, data.user_id);
 },

 [GatewayDispatchEvents.GuildSoundboardSoundCreate]: async (
  data: GatewayGuildSoundboardSoundCreateDispatchData,
 ) => {
  if (!data.guild_id) return;
  firstGuildInteraction(data.guild_id);

  cache.sounds.set(data.guild_id, (cache.sounds.get(data.guild_id) || 0) + 1);

  redis.soundboards.set(data);
 },

 [GatewayDispatchEvents.GuildSoundboardSoundDelete]: async (
  data: GatewayGuildSoundboardSoundDeleteDispatchData,
 ) => {
  firstGuildInteraction(data.guild_id);
  cache.sounds.set(data.guild_id, (cache.sounds.get(data.guild_id) || 1) - 1);

  redis.soundboards.del(data.sound_id);
 },

 [GatewayDispatchEvents.GuildSoundboardSoundUpdate]: async (
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

  const sounds = await redis.cacheDb.hgetall(redis.soundboards.keystore(data.guild_id));
  const pipeline = redis.cacheDb.pipeline();
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

  const stickers = await redis.cacheDb.hgetall(redis.stickers.keystore(data.guild_id));
  const pipeline = redis.cacheDb.pipeline();
  pipeline.del(...Object.keys(stickers));
  pipeline.del(redis.stickers.keystore(data.guild_id));
  await pipeline.exec();

  data.stickers.forEach((sticker) => redis.stickers.set({ ...sticker, guild_id: data.guild_id }));
 },
} as const;
