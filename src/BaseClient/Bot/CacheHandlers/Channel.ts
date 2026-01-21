import {
 GatewayDispatchEvents,
 type GatewayChannelCreateDispatchData,
 type GatewayChannelDeleteDispatchData,
 type GatewayChannelPinsUpdateDispatchData,
 type GatewayChannelUpdateDispatchData,
} from 'discord-api-types/gateway/v10';

import redis from '../Cache.js';

export default {
 [GatewayDispatchEvents.ChannelCreate]: (data: GatewayChannelCreateDispatchData) => {
  redis.channels.set(data);
 },

 [GatewayDispatchEvents.ChannelDelete]: async (data: GatewayChannelDeleteDispatchData) => {
  redis.channels.del(data.id);
  redis.pins.delAll(data.id);
  redis.channelStatus.del(data.guild_id, data.id);

  const messageKeys = await redis.cacheDb.hscanKeys(
   redis.messages.keystore(data.guild_id),
   `*${data.id}*`,
  );

  if (messageKeys.length === 0) return;

  const pipeline = redis.cacheDb.pipeline();
  pipeline.hdel(redis.messages.keystore(data.guild_id), ...messageKeys);
  pipeline.del(...messageKeys);
  await pipeline.exec();
 },

 [GatewayDispatchEvents.ChannelPinsUpdate]: async (_: GatewayChannelPinsUpdateDispatchData) => {},

 [GatewayDispatchEvents.ChannelUpdate]: async (data: GatewayChannelUpdateDispatchData) => {
  redis.channels.set(data);
 },

 // eslint-disable-next-line @typescript-eslint/naming-convention
 VOICE_CHANNEL_STATUS_UPDATE: async (data: { status: string; id: string; guild_id: string }) => {
  if (!data.status?.length) {
   redis.channelStatus.del(data.guild_id, data.id);
   return;
  }

  redis.channelStatus.set(data.guild_id, data.id, data.status);
 },

 // eslint-disable-next-line @typescript-eslint/naming-convention
 CHANNEL_STATUSES: async (data: {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  guild_id: string;
  channels: { status: string; id: string }[];
 }) => {
  await redis.channelStatus.delAll(data.guild_id);

  data.channels.forEach((c) => {
   if (!c.status.length) return;
   redis.channelStatus.set(data.guild_id, c.id, c.status);
  });
 },
} as const;
