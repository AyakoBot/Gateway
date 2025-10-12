import {
 GatewayDispatchEvents,
 type GatewayThreadCreateDispatchData,
 type GatewayThreadDeleteDispatchData,
 type GatewayThreadListSyncDispatchData,
 type GatewayThreadMembersUpdateDispatchData,
 type GatewayThreadMemberUpdateDispatchData,
 type GatewayThreadUpdateDispatchData,
} from 'discord-api-types/v10';

import firstChannelInteraction from '../../../Util/firstChannelInteraction.js';
import firstGuildInteraction from '../../../Util/firstGuildInteraction.js';
import RedisClient, { cache as redis } from '../Redis.js';

export default {
 [GatewayDispatchEvents.ThreadCreate]: async (data: GatewayThreadCreateDispatchData) => {
  if (!data.guild_id) return;

  await firstGuildInteraction(data.guild_id);

  redis.threads.set(data);
 },

 [GatewayDispatchEvents.ThreadDelete]: async (data: GatewayThreadDeleteDispatchData) => {
  redis.threads.del(data.id);

  await firstGuildInteraction(data.guild_id);

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

 [GatewayDispatchEvents.ThreadUpdate]: async (data: GatewayThreadUpdateDispatchData) => {
  if (!data.guild_id) {
   redis.threads.set(data);
   return;
  }

  await firstGuildInteraction(data.guild_id);
  await firstChannelInteraction(data.id, data.guild_id);

  redis.threads.set(data);
 },

 [GatewayDispatchEvents.ThreadListSync]: async (data: GatewayThreadListSyncDispatchData) => {
  await firstGuildInteraction(data.guild_id);

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
  await firstGuildInteraction(data.guild_id);
  await firstChannelInteraction(data.id, data.guild_id);

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
  await firstGuildInteraction(data.guild_id);
  if (data.id) await firstChannelInteraction(data.id, data.guild_id);

  redis.threadMembers.set(data, data.guild_id);

  if (!data.member) return;
  redis.members.set(data.member, data.guild_id);
 },
} as const;
