import {
 GatewayDispatchEvents,
 type GatewayThreadCreateDispatchData,
 type GatewayThreadDeleteDispatchData,
 type GatewayThreadListSyncDispatchData,
 type GatewayThreadMembersUpdateDispatchData,
 type GatewayThreadMemberUpdateDispatchData,
 type GatewayThreadUpdateDispatchData,
} from 'discord-api-types/v10';

import RedisClient, { cache as redis } from '../Redis.js';

export default {
 [GatewayDispatchEvents.ThreadCreate]: (data: GatewayThreadCreateDispatchData) => {
  if (!data.guild_id) return;

  redis.threads.set(data);
 },

 [GatewayDispatchEvents.ThreadDelete]: async (data: GatewayThreadDeleteDispatchData) => {
  redis.threads.del(data.id);

  const selectPipeline = RedisClient.pipeline();
  selectPipeline.hgetall(redis.threadMembers.keystore(data.guild_id));
  selectPipeline.hgetall(redis.messages.keystore(data.guild_id));
  const result = await selectPipeline.exec();
  if (!result) return;

  const [threadMembers, messages] = result;
  const deletePipeline = RedisClient.pipeline();

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

 [GatewayDispatchEvents.ThreadUpdate]: (data: GatewayThreadUpdateDispatchData) => {
  if (!data.guild_id) {
   redis.threads.set(data);
   return;
  }

  redis.threads.set(data);
 },

 [GatewayDispatchEvents.ThreadListSync]: (data: GatewayThreadListSyncDispatchData) => {
  data.threads.forEach((thread) =>
   redis.threads.set({ ...thread, guild_id: data.guild_id || thread.guild_id }),
  );

  data.members.forEach((threadMember) => {
   redis.threadMembers.set(threadMember, data.guild_id);

   if (!threadMember.member) return;
   redis.members.set(threadMember.member, data.guild_id);
  });
 },

 [GatewayDispatchEvents.ThreadMembersUpdate]: (data: GatewayThreadMembersUpdateDispatchData) => {
  data.added_members?.forEach((threadMember) => {
   redis.threadMembers.set(threadMember, data.guild_id);

   if (!threadMember.member) return;
   redis.members.set(threadMember.member, data.guild_id);
  });

  data.removed_member_ids?.forEach((id) => redis.threadMembers.del(data.id, id));
 },

 [GatewayDispatchEvents.ThreadMemberUpdate]: (data: GatewayThreadMemberUpdateDispatchData) => {
  redis.threadMembers.set(data, data.guild_id);

  if (!data.member) return;
  redis.members.set(data.member, data.guild_id);
 },
} as const;
