import {
 GatewayDispatchEvents,
 GuildNSFWLevel,
 GuildVerificationLevel,
 InviteType,
 type GatewayInviteCreateDispatchData,
 type GatewayInviteDeleteDispatchData,
} from 'discord-api-types/v10';

import firstGuildInteraction from '../../../Util/firstGuildInteraction.js';
import { cache as redis } from '../Redis.js';

export default {
 [GatewayDispatchEvents.InviteCreate]: async (data: GatewayInviteCreateDispatchData) => {
  if (data.inviter) redis.users.set(data.inviter);

  if (data.target_user) redis.users.set(data.target_user);

  if (data.guild_id) {
   firstGuildInteraction(data.guild_id);

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
   });
  }
 },

 [GatewayDispatchEvents.InviteDelete]: (data: GatewayInviteDeleteDispatchData) => {
  redis.invites.del(data.channel_id, data.code, data.guild_id);
 },
} as const;
