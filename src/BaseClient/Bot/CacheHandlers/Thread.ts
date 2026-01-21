import {
 GatewayDispatchEvents,
 type GatewayThreadCreateDispatchData,
 type GatewayThreadDeleteDispatchData,
 type GatewayThreadListSyncDispatchData,
 type GatewayThreadMembersUpdateDispatchData,
 type GatewayThreadMemberUpdateDispatchData,
 type GatewayThreadUpdateDispatchData,
} from 'discord-api-types/gateway/v10';

import firstGuildInteraction from '../../../Util/firstGuildInteraction.js';
import redis from '../Cache.js';

export default {
 [GatewayDispatchEvents.ThreadCreate]: async (data: GatewayThreadCreateDispatchData) => {
  if (!data.guild_id) return;

  firstGuildInteraction(data.guild_id);

  redis.threads.set(data);
 },

 [GatewayDispatchEvents.ThreadDelete]: async (data: GatewayThreadDeleteDispatchData) => {
  redis.threads.del(data.id);

  firstGuildInteraction(data.guild_id);

  const [threadMemberKeys, messageKeys] = await Promise.all([
   redis.cacheDb.hscanKeys(redis.threadMembers.keystore(data.guild_id), `*${data.id}*`),
   redis.cacheDb.hscanKeys(redis.messages.keystore(data.guild_id), `*${data.id}*`),
  ]);

  if (threadMemberKeys.length === 0 && messageKeys.length === 0) return;

  const deletePipeline = redis.cacheDb.pipeline();

  if (threadMemberKeys.length > 0) {
   deletePipeline.hdel(redis.threadMembers.keystore(data.guild_id), ...threadMemberKeys);
   deletePipeline.del(...threadMemberKeys);
  }

  if (messageKeys.length > 0) {
   deletePipeline.hdel(redis.messages.keystore(data.guild_id), ...messageKeys);
   deletePipeline.del(...messageKeys);
  }

  await deletePipeline.exec();
 },

 [GatewayDispatchEvents.ThreadUpdate]: async (data: GatewayThreadUpdateDispatchData) => {
  if (data.guild_id) firstGuildInteraction(data.guild_id);

  redis.threads.set(data);
 },

 [GatewayDispatchEvents.ThreadListSync]: async (data: GatewayThreadListSyncDispatchData) => {
  firstGuildInteraction(data.guild_id);

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
  firstGuildInteraction(data.guild_id);

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
  firstGuildInteraction(data.guild_id);

  redis.threadMembers.set(data, data.guild_id);

  if (!data.member) return;
  redis.members.set(data.member, data.guild_id);
 },
} as const;
