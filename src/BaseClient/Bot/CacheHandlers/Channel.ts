import {
 GatewayDispatchEvents,
 type GatewayChannelCreateDispatchData,
 type GatewayChannelDeleteDispatchData,
 type GatewayChannelPinsUpdateDispatchData,
 type GatewayChannelUpdateDispatchData,
} from 'discord-api-types/v10';

import firstChannelInteraction, { tasks } from '../../../Util/firstChannelInteraction.js';
import RedisClient, { cache as redis } from '../Redis.js';

export default {
 [GatewayDispatchEvents.ChannelCreate]: (data: GatewayChannelCreateDispatchData) => {
  redis.channels.set(data);
 },

 [GatewayDispatchEvents.ChannelDelete]: async (data: GatewayChannelDeleteDispatchData) => {
  redis.channels.del(data.id);
  redis.pins.delAll(data.id);
  redis.channelStatuses.del(data.guild_id, data.id);

  const pipeline = RedisClient.pipeline();
  const messages = await RedisClient.hgetall(redis.messages.keystore(data.guild_id));

  pipeline.hdel(
   redis.messages.keystore(data.guild_id),
   ...Object.keys(messages).filter((m) => m.includes(data.id)),
  );
  pipeline.del(...Object.keys(messages).filter((m) => m.includes(data.id)));
  pipeline.exec();
 },

 [GatewayDispatchEvents.ChannelPinsUpdate]: async (data: GatewayChannelPinsUpdateDispatchData) => {
  if (!data.guild_id) return;

  const success = await firstChannelInteraction(data.channel_id, data.guild_id);
  if (success) return;

  tasks.pins(data.channel_id, data.guild_id);
 },

 [GatewayDispatchEvents.ChannelUpdate]: async (data: GatewayChannelUpdateDispatchData) => {
  await firstChannelInteraction(data.id, data.guild_id);
  redis.channels.set(data);
 },

 // eslint-disable-next-line @typescript-eslint/naming-convention
 VOICE_CHANNEL_STATUS_UPDATE: async (data: { status: string; id: string; guild_id: string }) => {
  await firstChannelInteraction(data.id, data.guild_id);

  if (!data.status?.length) {
   redis.channelStatuses.del(data.guild_id, data.id);
   return;
  }

  redis.channelStatuses.set(data.guild_id, data.id, data.status);
 },

 // eslint-disable-next-line @typescript-eslint/naming-convention
 CHANNEL_STATUSES: async (data: {
  guild_id: string;
  channels: { status: string; id: string }[];
 }) => {
  await Promise.all(
   data.channels.map(async (c) => await firstChannelInteraction(c.id, data.guild_id)),
  );

  await redis.channelStatuses.delAll(data.guild_id);

  data.channels.forEach((c) => {
   if (!c.status.length) return;
   redis.channelStatuses.set(data.guild_id, c.id, c.status);
  });
 },
} as const;
