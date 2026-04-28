import type { ChainableCommanderInterface } from '@ayako/utility';
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

import firstGuildInteraction from '../../../Util/firstGuildInteraction.js';
import { priorityQueue } from '../../../Util/PriorityQueue/index.js';
import redis from '../Cache.js';
import { cache } from '../Client.js';

export default {
 [GatewayDispatchEvents.GuildAuditLogEntryCreate]: async (
  data: GatewayGuildAuditLogEntryCreateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.audits.set(data, data.guild_id));
  return p;
 },

 [GatewayDispatchEvents.GuildBanAdd]: async (
  data: GatewayGuildBanAddDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.bans.set({ reason: '-', user: data.user }, data.guild_id));
  p.push(redis.users.set(data.user));
  return p;
 },

 [GatewayDispatchEvents.GuildBanRemove]: async (
  data: GatewayGuildBanRemoveDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.bans.del(data.guild_id, data.user.id));
  p.push(redis.users.set(data.user));
  return p;
 },

 [GatewayDispatchEvents.GuildCreate]: (
  data: GatewayGuildCreateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (data.unavailable) return p;
  if ('geo_restricted' in data && data.geo_restricted) return p;

  const guildId = data.id;

  cache.members.set(guildId, data.member_count || 0);
  cache.emojis.set(guildId, data.emojis?.length || 0);
  cache.roles.set(guildId, data.roles?.length || 0);
  cache.stickers.set(guildId, data.stickers?.length || 0);
  cache.sounds.set(guildId, data.soundboard_sounds?.length || 0);

  const rGuild = redis.guilds.apiToR(data);
  if (rGuild) {
   const guildJson = JSON.stringify(rGuild);
   redis.queueSync((p: ChainableCommanderInterface) => {
    p.set(`${redis.guilds.key(guildId)}:current`, guildJson, 'EX', 604800);
    p.hset(redis.guilds.keystore(), redis.guilds.key(guildId), 0);
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
    redis.queueSync((pipe: ChainableCommanderInterface) => {
     pipe.set(`${redis.members.key(guildId, userId)}:current`, memberJson, 'EX', 604800);
     pipe.hset(redis.members.keystore(guildId), redis.members.key(guildId, userId), 0);
    });
   }
   if (rUser) {
    const userJson = JSON.stringify(rUser);
    redis.queueSync((pipe: ChainableCommanderInterface) => {
     pipe.set(`${redis.users.key(userId)}:current`, userJson, 'EX', 604800);
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
    redis.queueSync((p: ChainableCommanderInterface) => {
     p.set(`${redis.channels.key(channel.id)}:current`, channelJson, 'EX', 604800);
     p.hset(redis.channels.keystore(guildId), redis.channels.key(channel.id), 0);
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
    redis.queueSync((p: ChainableCommanderInterface) => {
     p.set(`${redis.roles.key(role.id)}:current`, roleJson, 'EX', 604800);
     p.hset(redis.roles.keystore(guildId), redis.roles.key(role.id), 0);
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
    redis.queueSync((p: ChainableCommanderInterface) => {
     p.set(`${redis.emojis.key(emoji.id || emoji.name || '')}:current`, emojiJson, 'EX', 604800);
     p.hset(redis.emojis.keystore(guildId), redis.emojis.key(emoji.id || emoji.name || ''), 0);
    });
   }
  }
  (data as { emojis?: unknown }).emojis = undefined;

  for (let i = 0; i < (data.stickers || []).length; i++) {
   const sticker = data.stickers![i];
   const rSticker = redis.stickers.apiToR({ ...sticker, guild_id: guildId });
   (data.stickers as unknown[])[i] = undefined;
   if (rSticker) {
    const stickerJson = JSON.stringify(rSticker);
    redis.queueSync((p: ChainableCommanderInterface) => {
     p.set(`${redis.stickers.key(sticker.id)}:current`, stickerJson, 'EX', 604800);
     p.hset(redis.stickers.keystore(guildId), redis.stickers.key(sticker.id), 0);
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
    redis.queueSync((p: ChainableCommanderInterface) => {
     p.set(`${redis.soundboards.key(sound.sound_id)}:current`, soundJson, 'EX', 604800);
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
    redis.queueSync((p: ChainableCommanderInterface) => {
     p.set(`${redis.voices.key(guildId, voice.user_id)}:current`, voiceJson, 'EX', 604800);
     p.hset(redis.voices.keystore(guildId), redis.voices.key(guildId, voice.user_id), 0);
    });
   }
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  (data as { voice_states?: unknown }).voice_states = undefined;

  for (let i = 0; i < data.threads.length; i++) {
   const thread = data.threads[i];
   const rThread = redis.threads.apiToR({ ...thread, guild_id: guildId });
   (data.threads as unknown[])[i] = undefined;
   if (rThread && thread.parent_id) {
    const threadJson = JSON.stringify(rThread);
    redis.queueSync((p: ChainableCommanderInterface) => {
     p.set(`${redis.threads.key(thread.id)}:current`, threadJson, 'EX', 604800);
     p.hset(redis.threads.keystore(guildId, thread.parent_id!), redis.threads.key(thread.id), 0);
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
    redis.queueSync((p: ChainableCommanderInterface) => {
     p.set(`${redis.events.key(event.id)}:current`, eventJson, 'EX', 604800);
     p.hset(redis.events.keystore(event.guild_id), redis.events.key(event.id), 0);
    });
   }
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  (data as { guild_scheduled_events?: unknown }).guild_scheduled_events = undefined;

  for (let i = 0; i < data.stage_instances.length; i++) {
   const stage = data.stage_instances[i];
   const rStage = redis.stages.apiToR(stage);
   (data.stage_instances as unknown[])[i] = undefined;
   if (rStage) {
    const stageJson = JSON.stringify(rStage);
    redis.queueSync((p: ChainableCommanderInterface) => {
     p.set(`${redis.stages.key(stage.id)}:current`, stageJson, 'EX', 604800);
     p.hset(redis.stages.keystore(stage.guild_id), redis.stages.key(stage.id), 0);
    });
   }
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  (data as { stage_instances?: unknown }).stage_instances = undefined;

  return p;
 },

 [GatewayDispatchEvents.GuildDelete]: async (
  data: GatewayGuildDeleteDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  cache.members.delete(data.id);
  cache.emojis.delete(data.id);
  cache.roles.delete(data.id);
  cache.stickers.delete(data.id);
  cache.sounds.delete(data.id);

  p.push(redis.guilds.del(data.id));
  p.push(redis.channelStatus.delAll(data.id));
  p.push(redis.pins.delAll(data.id));

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
   threadMembers,
   voices,
   webhooks,
   welcomeScreens,
   onboardings,
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
   redis.cacheDb.hscanKeys(redis.threadMembers.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.voices.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.webhooks.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.welcomeScreens.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.onboardings.keystore(data.id)),
   redis.cacheDb.hscanKeys(redis.eventUsers.keystore(data.id)),
  ]);

  const channelIds = channels.map((k) => k.split(':').slice(2).join(':'));
  const threadCleanup = await redis.threads.getAllGuildKeys(data.id, channelIds);

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
  deletePipeline.del(...threadCleanup.keystoreKeys);
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
  deletePipeline.del(...threadCleanup.dataKeys);
  deletePipeline.del(...threadMembers);
  deletePipeline.del(...voices);
  deletePipeline.del(...webhooks);
  deletePipeline.del(...welcomeScreens);
  deletePipeline.del(...onboardings);
  deletePipeline.del(...eventUsers);

  p.push(deletePipeline.exec());
  return p;
 },

 [GatewayDispatchEvents.GuildUpdate]: async (
  data: GatewayGuildUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.id));
  p.push(redis.guilds.set(data));
  return p;
 },

 [GatewayDispatchEvents.GuildEmojisUpdate]: async (
  data: GatewayGuildEmojisUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  cache.emojis.set(data.guild_id, data.emojis.length);

  const emojiKeys = await redis.cacheDb.hscanKeys(redis.emojis.keystore(data.guild_id));
  const pipeline = redis.cacheDb.pipeline();
  pipeline.del(...emojiKeys);
  pipeline.del(redis.emojis.keystore(data.guild_id));
  p.push(pipeline.exec());

  data.emojis.forEach((emoji) => p.push(redis.emojis.set(emoji, data.guild_id)));
  return p;
 },

 [GatewayDispatchEvents.GuildIntegrationsUpdate]: async (
  data: GatewayGuildIntegrationsUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  const success = await firstGuildInteraction(data.guild_id);
  if (success) return p;

  const memberCount = cache.members.get(data.guild_id) || 0;
  priorityQueue.enqueueGuildTask(data.guild_id, memberCount, 'integrations');
  return p;
 },

 [GatewayDispatchEvents.GuildMemberAdd]: async (
  data: GatewayGuildMemberAddDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  cache.members.set(data.guild_id, (cache.members.get(data.guild_id) || 0) + 1);

  p.push(redis.members.set(data, data.guild_id));
  p.push(redis.users.set(data.user));
  return p;
 },

 [GatewayDispatchEvents.GuildMemberRemove]: async (
  data: GatewayGuildMemberRemoveDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  cache.members.set(data.guild_id, (cache.members.get(data.guild_id) || 0) - 1);

  p.push(redis.members.del(data.guild_id, data.user.id));
  p.push(redis.users.set(data.user));
  return p;
 },

 [GatewayDispatchEvents.GuildMembersChunk]: async (
  data: GatewayGuildMembersChunkDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (data.chunk_count === data.chunk_index + 1) {
   // eslint-disable-next-line no-console
   console.log('[Chunk] Finished receiving member chunks for', data.guild_id);

   priorityQueue.onMemberChunkComplete(data.guild_id);
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
    p.push(pipeline.exec());
   }
  }

  p.push(redis.members.setMany(data.members, data.guild_id));
  return p;
 },

 [GatewayDispatchEvents.GuildMemberUpdate]: async (
  data: GatewayGuildMemberUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));

  if (data.joined_at && data.deaf && data.mute) {
   p.push(redis.members.set(data as Parameters<typeof redis.members.set>[0], data.guild_id));
   return p;
  }

  const member = await redis.members.get(data.guild_id, data.user.id);
  if (!member) {
   p.push(
    redis.members.set(
     {
      ...data,
      joined_at: data.joined_at || new Date().toISOString(),
      mute: data.mute || false,
      deaf: data.deaf || false,
      flags: data.flags || (0 as GuildMemberFlags),
     },
     data.guild_id,
    ),
   );
   return p;
  }

  const mergedMember = { ...data };

  if (!data.user) return p;
  p.push(
   redis.members.set(
    {
     ...mergedMember,
     deaf: mergedMember.deaf || false,
     mute: mergedMember.mute || false,
     flags: mergedMember.flags || (0 as GuildMemberFlags),
     joined_at: mergedMember.joined_at || new Date().toISOString(),
    },
    data.guild_id,
   ),
  );
  return p;
 },

 [GatewayDispatchEvents.GuildRoleCreate]: async (
  data: GatewayGuildRoleCreateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  cache.roles.set(data.guild_id, (cache.roles.get(data.guild_id) || 1) + 1);

  p.push(redis.roles.set(data.role, data.guild_id));
  return p;
 },

 [GatewayDispatchEvents.GuildRoleDelete]: async (
  data: GatewayGuildRoleDeleteDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  cache.roles.set(data.guild_id, (cache.roles.get(data.guild_id) || 1) - 1);

  p.push(redis.roles.del(data.role_id));
  return p;
 },

 [GatewayDispatchEvents.GuildRoleUpdate]: async (
  data: GatewayGuildRoleCreateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.roles.set(data.role, data.guild_id));
  return p;
 },

 [GatewayDispatchEvents.GuildScheduledEventCreate]: async (
  data: GatewayGuildScheduledEventCreateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.events.set(data));
  return p;
 },

 [GatewayDispatchEvents.GuildScheduledEventDelete]: async (
  data: GatewayGuildScheduledEventDeleteDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.events.del(data.id));
  return p;
 },

 [GatewayDispatchEvents.GuildScheduledEventUpdate]: async (
  data: GatewayGuildScheduledEventUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.events.set(data));
  return p;
 },

 [GatewayDispatchEvents.GuildScheduledEventUserAdd]: async (
  data: GatewayGuildScheduledEventUserAddDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.eventUsers.set(data, data.guild_id));
  return p;
 },

 [GatewayDispatchEvents.GuildScheduledEventUserRemove]: async (
  data: GatewayGuildScheduledEventUserRemoveDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.eventUsers.del(data.guild_scheduled_event_id, data.user_id));
  return p;
 },

 [GatewayDispatchEvents.GuildSoundboardSoundCreate]: async (
  data: GatewayGuildSoundboardSoundCreateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (!data.guild_id) return p;
  p.push(firstGuildInteraction(data.guild_id));
  cache.sounds.set(data.guild_id, (cache.sounds.get(data.guild_id) || 0) + 1);
  p.push(redis.soundboards.set(data));
  return p;
 },

 [GatewayDispatchEvents.GuildSoundboardSoundDelete]: async (
  data: GatewayGuildSoundboardSoundDeleteDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  cache.sounds.set(data.guild_id, (cache.sounds.get(data.guild_id) || 1) - 1);
  p.push(redis.soundboards.del(data.sound_id));
  return p;
 },

 [GatewayDispatchEvents.GuildSoundboardSoundUpdate]: async (
  data: GatewayGuildSoundboardSoundUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (!data.guild_id) return p;
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.soundboards.set(data));
  return p;
 },

 [GatewayDispatchEvents.GuildSoundboardSoundsUpdate]: async (
  data: GatewayGuildSoundboardSoundsUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  cache.sounds.set(data.guild_id, data.soundboard_sounds.length);

  const soundKeys = await redis.cacheDb.hscanKeys(redis.soundboards.keystore(data.guild_id));
  const pipeline = redis.cacheDb.pipeline();
  pipeline.del(...soundKeys);
  pipeline.del(redis.soundboards.keystore(data.guild_id));
  p.push(pipeline.exec());

  data.soundboard_sounds.forEach((sound) =>
   p.push(redis.soundboards.set({ ...sound, guild_id: data.guild_id })),
  );
  return p;
 },

 [GatewayDispatchEvents.GuildStickersUpdate]: async (
  data: GatewayGuildStickersUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));
  cache.stickers.set(data.guild_id, data.stickers.length);

  const stickerKeys = await redis.cacheDb.hscanKeys(redis.stickers.keystore(data.guild_id));
  const pipeline = redis.cacheDb.pipeline();
  pipeline.del(...stickerKeys);
  pipeline.del(redis.stickers.keystore(data.guild_id));
  p.push(pipeline.exec());

  data.stickers.forEach((sticker) =>
   p.push(redis.stickers.set({ ...sticker, guild_id: data.guild_id })),
  );
  return p;
 },
} as const;
