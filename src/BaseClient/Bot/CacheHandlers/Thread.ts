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
 [GatewayDispatchEvents.ThreadCreate]: async (
  data: GatewayThreadCreateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (!data.guild_id) return p;
  p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.threads.set(data));
  return p;
 },

 [GatewayDispatchEvents.ThreadDelete]: async (
  data: GatewayThreadDeleteDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(redis.threads.del(data.id));
  p.push(
   redis.cacheDb.hdel(
    redis.threads.keystore(data.guild_id, data.parent_id),
    redis.threads.key(data.id),
   ),
  );

  p.push(firstGuildInteraction(data.guild_id));

  const [threadMemberKeys, messageKeys] = await Promise.all([
   redis.cacheDb.hscanKeys(redis.threadMembers.keystore(data.guild_id), `*${data.id}*`),
   redis.cacheDb.hscanKeys(redis.messages.keystore(data.guild_id), `*${data.id}*`),
  ]);

  if (threadMemberKeys.length === 0 && messageKeys.length === 0) return p;

  const deletePipeline = redis.cacheDb.pipeline();

  if (threadMemberKeys.length > 0) {
   deletePipeline.hdel(redis.threadMembers.keystore(data.guild_id), ...threadMemberKeys);
   deletePipeline.del(...threadMemberKeys);
  }

  if (messageKeys.length > 0) {
   deletePipeline.hdel(redis.messages.keystore(data.guild_id), ...messageKeys);
   deletePipeline.del(...messageKeys);
  }

  p.push(deletePipeline.exec());
  return p;
 },

 [GatewayDispatchEvents.ThreadUpdate]: async (
  data: GatewayThreadUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (data.guild_id) p.push(firstGuildInteraction(data.guild_id));
  p.push(redis.threads.set(data));
  return p;
 },

 [GatewayDispatchEvents.ThreadListSync]: async (
  data: GatewayThreadListSyncDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  firstGuildInteraction(data.guild_id);

  data.threads.forEach((thread) =>
   p.push(redis.threads.set({ ...thread, guild_id: data.guild_id || thread.guild_id })),
  );

  return p;
 },

 [GatewayDispatchEvents.ThreadMembersUpdate]: async (
  data: GatewayThreadMembersUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));

  data.added_members?.forEach((threadMember) => {
   p.push(redis.threadMembers.set(threadMember, data.guild_id));

   if (!threadMember.member) return;
   p.push(redis.members.set(threadMember.member, data.guild_id));
  });

  data.removed_member_ids?.forEach((id) => p.push(redis.threadMembers.del(data.id, id)));
  return p;
 },

 [GatewayDispatchEvents.ThreadMemberUpdate]: async (
  data: GatewayThreadMemberUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(firstGuildInteraction(data.guild_id));

  p.push(redis.threadMembers.set(data, data.guild_id));

  if (!data.member) return p;
  p.push(redis.members.set(data.member, data.guild_id));

  return p;
 },
} as const;
