import {
 GatewayDispatchEvents,
 type GatewayThreadCreateDispatchData,
 type GatewayThreadDeleteDispatchData,
 type GatewayThreadListSyncDispatchData,
 type GatewayThreadMembersUpdateDispatchData,
 type GatewayThreadMemberUpdateDispatchData,
 type GatewayThreadUpdateDispatchData,
} from 'discord-api-types/v10';

import emit from '../../../Util/EventBus.js';
import type { RMessage } from '../CacheClasses/message.js';
import type { RThread } from '../CacheClasses/thread.js';
import type { RThreadMember } from '../CacheClasses/threadMember.js';
import RedisClient, { cache as redis } from '../Redis.js';

export default {
 [GatewayDispatchEvents.ThreadCreate]: async (data: GatewayThreadCreateDispatchData) => {
  if (!data.guild_id) return;

  redis.threads.set(data);

  emit(GatewayDispatchEvents.ThreadCreate, {
   thread: redis.threads.apiToR(data) as RThread,
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
   newly_created: data.newly_created ?? false,
  });
 },

 [GatewayDispatchEvents.ThreadDelete]: async (data: GatewayThreadDeleteDispatchData) => {
  const existing = await redis.threads.get(data.id);
  redis.threads.del(data.id);

  const selectPipeline = RedisClient.pipeline();
  selectPipeline.hgetall(redis.threadMembers.keystore(data.guild_id));
  selectPipeline.hgetall(redis.messages.keystore(data.guild_id));
  const result = await selectPipeline.exec();
  if (!result) {
   emit(GatewayDispatchEvents.ThreadDelete, {
    guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
    thread: existing || { id: data.id },
    parent: (await redis.channels.get(data.parent_id)) || { id: data.parent_id },
    type: data.type,

    members: [],
    messages: [],
   });

   return;
  }

  const [threadMembers, messages] = result;
  const deletePipeline = RedisClient.pipeline();

  emit(GatewayDispatchEvents.ThreadDelete, {
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
   thread: existing || { id: data.id },
   parent: (await redis.channels.get(data.parent_id)) || { id: data.parent_id },
   type: data.type,

   messages: Object.values(messages[1] as string).map((m) => JSON.parse(m) as RMessage),
   members: Object.values(threadMembers[1] as string).map((m) => JSON.parse(m) as RThreadMember),
  });

  deletePipeline.hdel(
   redis.threadMembers.keystore(data.guild_id),
   ...Object.keys(threadMembers).filter((m) => m.includes(data.id)),
  );
  deletePipeline.del(...Object.keys(threadMembers).filter((m) => m.includes(data.id)));

  deletePipeline.hdel(
   redis.messages.keystore(data.guild_id),
   ...Object.keys(messages).filter((m) => m.includes(data.id)),
  );
  deletePipeline.del(...Object.keys(messages).filter((m) => m.includes(data.id)));

  deletePipeline.exec();
 },

 [GatewayDispatchEvents.ThreadUpdate]: async (data: GatewayThreadUpdateDispatchData) => {
  if (!data.guild_id) {
   redis.threads.set(data);
   return;
  }

  emit(GatewayDispatchEvents.ThreadUpdate, {
   after: redis.threads.apiToR(data) as RThread,
   before: await redis.threads.get(data.id),
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
  });

  redis.threads.set(data);
 },

 [GatewayDispatchEvents.ThreadListSync]: async (data: GatewayThreadListSyncDispatchData) => {
  emit(GatewayDispatchEvents.ThreadListSync, {
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
   parents: await Promise.all(
    data.channel_ids?.map((c) => redis.channels.get(c).then((channel) => channel || { id: c })) ||
     [],
   ),
   threads: data.threads.map((t) => redis.threads.apiToR(t) as RThread),
   members: data.members.map((m) => redis.threadMembers.apiToR(m, data.guild_id) as RThreadMember),
  });

  data.threads.forEach((thread) =>
   redis.threads.set({ ...thread, guild_id: data.guild_id || thread.guild_id }),
  );

  data.members.forEach((threadMember) => {
   redis.threadMembers.set(threadMember, data.guild_id);

   if (!threadMember.member) return;
   redis.members.set(threadMember.member, data.guild_id);
  });
 },

 [GatewayDispatchEvents.ThreadMembersUpdate]: async (
  data: GatewayThreadMembersUpdateDispatchData,
 ) => {
  emit(GatewayDispatchEvents.ThreadMembersUpdate, {
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
   members: data.member_count,
   added: (data.added_members || []).map(
    (m) => redis.threadMembers.apiToR(m, data.guild_id) as RThreadMember,
   ),
   removed: await Promise.all(
    (data.removed_member_ids || []).map((id) =>
     redis.threadMembers.get(data.id, id).then((m) => m || { id }),
    ),
   ),
   thread: (await redis.threads.get(data.id)) || { id: data.id },
  });

  data.added_members?.forEach((threadMember) => {
   redis.threadMembers.set(threadMember, data.guild_id);

   if (!threadMember.member) return;
   redis.members.set(threadMember.member, data.guild_id);
  });

  data.removed_member_ids?.forEach((id) => redis.threadMembers.del(data.id, id));
 },

 [GatewayDispatchEvents.ThreadMemberUpdate]: async (
  data: GatewayThreadMemberUpdateDispatchData,
 ) => {
  emit(GatewayDispatchEvents.ThreadMemberUpdate, {
   before: await redis.threadMembers.get(data.id!, data.user_id!),
   after: redis.threadMembers.apiToR(data, data.guild_id) as RThreadMember,
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
  });

  redis.threadMembers.set(data, data.guild_id);

  if (!data.member) return;
  redis.members.set(data.member, data.guild_id);
 },
} as const;
