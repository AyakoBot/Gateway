import {
 GatewayDispatchEvents,
 GuildNSFWLevel,
 GuildVerificationLevel,
 InviteType,
 type GatewayInviteCreateDispatchData,
 type GatewayInviteDeleteDispatchData,
} from 'discord-api-types/v10';

import emit from '../../../Util/EventBus.js';
import { cache as redis } from '../Redis.js';

export default {
 [GatewayDispatchEvents.InviteCreate]: async (data: GatewayInviteCreateDispatchData) => {
  if (data.inviter) await redis.users.set(data.inviter);

  if (data.target_user) await redis.users.set(data.target_user);

  if (data.guild_id) {
   await redis.invites.set({
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

  emit(GatewayDispatchEvents.InviteCreate, (await redis.invites.get(data.code)) || data);
 },

 [GatewayDispatchEvents.InviteDelete]: async (data: GatewayInviteDeleteDispatchData) => {
  emit(GatewayDispatchEvents.InviteDelete, (await redis.invites.get(data.code)) || data);

  redis.invites.del(data.code);
 },
} as const;
