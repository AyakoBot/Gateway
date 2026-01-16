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

 [GatewayDispatchEvents.GuildCreate]: (data: GatewayGuildCreateDispatchData) => {
  if (data.unavailable) return;
  if ('geo_restricted' in data && data.geo_restricted) return;

  const guildId = data.id;

  cache.guilds += 1;
  cache.members.set(guildId, data.member_count || 0);
  cache.emojis.set(guildId, data.emojis?.length || 0);
  cache.roles.set(guildId, data.roles?.length || 0);
  cache.stickers.set(guildId, data.stickers?.length || 0);
  cache.sounds.set(guildId, data.soundboard_sounds?.length || 0);

  const rGuild = redis.guilds.apiToR(data);
  if (rGuild) {
   const guildJson = JSON.stringify(rGuild);
   redis.queueSync((p) => {
    p.set(`cache:guilds:${guildId}:current`, guildJson, 'EX', 604800);
    p.hset('keystore:guilds', `cache:guilds:${guildId}`, 0);
   });
  }

  for (let i = 0; i < data.members.length; i++) {
   const member = data.members[i];
   if (!member?.user) continue;

   const userId = member.user.id;
   const rMember = redis.members.apiToR(member, guildId);
   const rUser = redis.users.apiToR(member.user);

   (data.members as unknown[])[i] = undefined;

   if (rMember) {
    const memberJson = JSON.stringify(rMember);
    redis.queueSync((p) => {
     p.set(`cache:members:${guildId}:${userId}:current`, memberJson, 'EX', 604800);
     p.hset(`keystore:members:${guildId}`, `cache:members:${guildId}:${userId}`, 0);
    });
   }
   if (rUser) {
    const userJson = JSON.stringify(rUser);
    redis.queueSync((p) => {
     p.set(`cache:users:${userId}:current`, userJson, 'EX', 604800);
    });
   }
  }
  (data as { members?: unknown }).members = undefined;

  for (let i = 0; i < data.channels.length; i++) {
   const channel = data.channels[i];
   const rChannel = redis.channels.apiToR({ ...channel, guild_id: guildId });
   (data.channels as unknown[])[i] = undefined;
   if (rChannel) {
    const channelJson = JSON.stringify(rChannel);
    redis.queueSync((p) => {
     p.set(`cache:channels:${channel.id}:current`, channelJson, 'EX', 604800);
     p.hset(`keystore:channels:${guildId}`, `cache:channels:${channel.id}`, 0);
    });
   }
  }
  (data as { channels?: unknown }).channels = undefined;

  for (let i = 0; i < data.roles.length; i++) {
   const role = data.roles[i];
   const rRole = redis.roles.apiToR(role, guildId);
   (data.roles as unknown[])[i] = undefined;
   if (rRole) {
    const roleJson = JSON.stringify(rRole);
    redis.queueSync((p) => {
     p.set(`cache:roles:${role.id}:current`, roleJson, 'EX', 604800);
     p.hset(`keystore:roles:${guildId}`, `cache:roles:${role.id}`, 0);
    });
   }
  }
  (data as { roles?: unknown }).roles = undefined;

  for (let i = 0; i < data.emojis.length; i++) {
   const emoji = data.emojis[i];
   if (!emoji.id) continue;
   const rEmoji = redis.emojis.apiToR(emoji, guildId);
   (data.emojis as unknown[])[i] = undefined;
   if (rEmoji) {
    const emojiJson = JSON.stringify(rEmoji);
    redis.queueSync((p) => {
     p.set(`cache:emojis:${emoji.id}:current`, emojiJson, 'EX', 604800);
     p.hset(`keystore:emojis:${guildId}`, `cache:emojis:${emoji.id}`, 0);
    });
   }
  }
  (data as { emojis?: unknown }).emojis = undefined;

  for (let i = 0; i < data.stickers.length; i++) {
   const sticker = data.stickers[i];
   const rSticker = redis.stickers.apiToR({ ...sticker, guild_id: guildId });
   (data.stickers as unknown[])[i] = undefined;
   if (rSticker) {
    const stickerJson = JSON.stringify(rSticker);
    redis.queueSync((p) => {
     p.set(`cache:stickers:${sticker.id}:current`, stickerJson, 'EX', 604800);
     p.hset(`keystore:stickers:${guildId}`, `cache:stickers:${sticker.id}`, 0);
    });
   }
  }
  (data as { stickers?: unknown }).stickers = undefined;

  for (let i = 0; i < data.soundboard_sounds.length; i++) {
   const sound = data.soundboard_sounds[i];
   const rSound = redis.soundboards.apiToR({ ...sound, guild_id: guildId });
   (data.soundboard_sounds as unknown[])[i] = undefined;
   if (rSound) {
    const soundJson = JSON.stringify(rSound);
    redis.queueSync((p) => {
     p.set(`cache:soundboards:${sound.sound_id}:current`, soundJson, 'EX', 604800);
    });
   }
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  (data as { soundboard_sounds?: unknown }).soundboard_sounds = undefined;

  for (let i = 0; i < data.voice_states.length; i++) {
   const voice = data.voice_states[i];
   if (!voice.user_id) continue;
   const rVoice = redis.voices.apiToR({ ...voice, guild_id: guildId });
   (data.voice_states as unknown[])[i] = undefined;
   if (rVoice) {
    const voiceJson = JSON.stringify(rVoice);
    redis.queueSync((p) => {
     p.set(`cache:voices:${guildId}:${voice.user_id}:current`, voiceJson, 'EX', 604800);
     p.hset(`keystore:voices:${guildId}`, `cache:voices:${guildId}:${voice.user_id}`, 0);
    });
   }
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  (data as { voice_states?: unknown }).voice_states = undefined;

  for (let i = 0; i < data.threads.length; i++) {
   const thread = data.threads[i];
   const rThread = redis.threads.apiToR({ ...thread, guild_id: guildId });
   (data.threads as unknown[])[i] = undefined;
   if (rThread) {
    const threadJson = JSON.stringify(rThread);
    redis.queueSync((p) => {
     p.set(`cache:threads:${thread.id}:current`, threadJson, 'EX', 604800);
     p.hset(`keystore:threads:${guildId}`, `cache:threads:${thread.id}`, 0);
    });
   }
  }
  (data as { threads?: unknown }).threads = undefined;

  for (let i = 0; i < data.guild_scheduled_events.length; i++) {
   const event = data.guild_scheduled_events[i];
   const rEvent = redis.events.apiToR(event);
   (data.guild_scheduled_events as unknown[])[i] = undefined;
   if (rEvent) {
    const eventJson = JSON.stringify(rEvent);
    redis.queueSync((p) => {
     p.set(`cache:events:${event.id}:current`, eventJson, 'EX', 604800);
     p.hset(`keystore:events:${event.guild_id}`, `cache:events:${event.id}`, 0);
    });
   }
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  (data as { guild_scheduled_events?: unknown }).guild_scheduled_events = undefined;
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
  ] = await Promise.all([
   redis.cacheDb.hscanKeys(redis.audits.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.automods.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.bans.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.channels.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.commandPermissions.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.emojis.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.events.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.guildCommands.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.integrations.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.invites.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.members.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.messages.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.reactions.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.roles.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.soundboards.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.stages.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.stickers.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.threads.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.threadMembers.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.voices.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.webhooks.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.welcomeScreens.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.onboardings.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.eventUsers.keystore(data.id)),
  ]);

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

  deletePipeline.del(...auditlogs);
  deletePipeline.del(...automods);
  deletePipeline.del(...bans);
  deletePipeline.del(...channels);
  deletePipeline.del(...commandPermissions);
  deletePipeline.del(...emojis);
  deletePipeline.del(...events);
  deletePipeline.del(...guildCommands);
  deletePipeline.del(...integrations);
  deletePipeline.del(...invites);
  deletePipeline.del(...members);
  deletePipeline.del(...messages);
  deletePipeline.del(...reactions);
  deletePipeline.del(...roles);
  deletePipeline.del(...soundboards);
  deletePipeline.del(...stages);
  deletePipeline.del(...stickers);
  deletePipeline.del(...threads);
  deletePipeline.del(...threadMembers);
  deletePipeline.del(...voices);
  deletePipeline.del(...webhooks);
  deletePipeline.del(...welcomeScreens);
  deletePipeline.del(...onboarding);
  deletePipeline.del(...eventUsers);

  await deletePipeline.exec();
 },

 [GatewayDispatchEvents.GuildUpdate]: async (data: GatewayGuildUpdateDispatchData) => {
  firstGuildInteraction(data.id);
  redis.guilds.set(data);
 },

 [GatewayDispatchEvents.GuildEmojisUpdate]: async (data: GatewayGuildEmojisUpdateDispatchData) => {
  firstGuildInteraction(data.guild_id);
  cache.emojis.set(data.guild_id, data.emojis.length);

  const emojiKeys = await redis.cacheDb.hscanKeys(redis.emojis.keystore(data.guild_id));
  const pipeline = redis.cacheDb.pipeline();
  pipeline.del(...emojiKeys);
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

  const soundKeys = await redis.cacheDb.hscanKeys(redis.soundboards.keystore(data.guild_id));
  const pipeline = redis.cacheDb.pipeline();
  pipeline.del(...soundKeys);
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

  const stickerKeys = await redis.cacheDb.hscanKeys(redis.stickers.keystore(data.guild_id));
  const pipeline = redis.cacheDb.pipeline();
  pipeline.del(...stickerKeys);
  pipeline.del(redis.stickers.keystore(data.guild_id));
  await pipeline.exec();

  data.stickers.forEach((sticker) => redis.stickers.set({ ...sticker, guild_id: data.guild_id }));
 },
} as const;
