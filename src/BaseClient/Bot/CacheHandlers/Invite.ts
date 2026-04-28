import {
 GatewayDispatchEvents,
 GuildNSFWLevel,
 GuildVerificationLevel,
 InviteType,
 type GatewayInviteCreateDispatchData,
 type GatewayInviteDeleteDispatchData,
} from 'discord-api-types/v10';

import firstGuildInteraction from '../../../Util/firstGuildInteraction.js';
import redis from '../Cache.js';

export default {
 [GatewayDispatchEvents.InviteCreate]: async (
  data: GatewayInviteCreateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (data.inviter) p.push(redis.users.set(data.inviter));
  if (data.target_user) p.push(redis.users.set(data.target_user));
  if (!data.guild_id) return p;

  p.push(firstGuildInteraction(data.guild_id));

  p.push(
   redis.invites.set({
    ...data,
    type: InviteType.Guild,
    guild: {
     id: data.guild_id,
     banner: null,
     description: null,
     features: [],
     icon: null,
     name: 'Unknown Guild',
     nsfw_level: GuildNSFWLevel.Default,
     splash: null,
     vanity_url_code: null,
     verification_level: GuildVerificationLevel.None,
    },
    inviter: data.inviter,
    target_user: data.target_user,
    guild_scheduled_event: undefined,
    stage_instance: undefined,
    channel: null,
   }),
  );
  return p;
 },

 [GatewayDispatchEvents.InviteDelete]: (
  data: GatewayInviteDeleteDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(redis.invites.del(data.channel_id, data.code, data.guild_id));
  return p;
 },
} as const;
