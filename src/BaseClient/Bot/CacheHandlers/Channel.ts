import {
 type GatewayChannelCreateDispatchData,
 type GatewayChannelDeleteDispatchData,
 type GatewayChannelInfoDispatchData,
 type GatewayChannelPinsUpdateDispatchData,
 type GatewayChannelUpdateDispatchData,
 GatewayDispatchEvents,
 type GatewayVoiceChannelEffectSendDispatchData,
 type GatewayVoiceChannelStartTimeUpdateDispatchData,
 type GatewayVoiceChannelStatusUpdateDispatchData,
} from 'discord-api-types/gateway/v10';

import redis from '../Cache.js';

export default {
 [GatewayDispatchEvents.ChannelCreate]: (
  data: GatewayChannelCreateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(redis.channels.set(data));
  return p;
 },

 [GatewayDispatchEvents.ChannelDelete]: async (
  data: GatewayChannelDeleteDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(redis.channels.del(data.id));
  p.push(redis.pins.delAll(data.id));
  p.push(redis.channelStatus.del(data.guild_id, data.id));

  const messageKeys = await redis.cacheDb.hscanKeys(
   redis.messages.keystore(data.guild_id),
   `*${data.id}*`,
  );

  if (messageKeys.length === 0) return p;

  const pipeline = redis.cacheDb.pipeline();
  pipeline.hdel(redis.messages.keystore(data.guild_id), ...messageKeys);
  pipeline.del(...messageKeys);
  p.push(pipeline.exec());
  return p;
 },

 [GatewayDispatchEvents.ChannelPinsUpdate]: async (
  _0: GatewayChannelPinsUpdateDispatchData,
  _1: number | undefined,
  p: Promise<unknown>[] = [],
 ) => p,

 [GatewayDispatchEvents.ChannelUpdate]: async (
  data: GatewayChannelUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(redis.channels.set(data));
  return p;
 },

 [GatewayDispatchEvents.VoiceChannelStatusUpdate]: async (
  data: GatewayVoiceChannelStatusUpdateDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  if (!data.status?.length) {
   p.push(redis.channelStatus.del(data.guild_id, data.id));
   return p;
  }

  p.push(redis.channelStatus.set(data.guild_id, data.id, data.status));
  return p;
 },

 [GatewayDispatchEvents.VoiceChannelEffectSend]: async (
  _0: GatewayVoiceChannelEffectSendDispatchData,
  _1: number | undefined,
  p: Promise<unknown>[] = [],
 ) => p,

 // eslint-disable-next-line @typescript-eslint/naming-convention
 CHANNEL_STATUSES: async (
  data: {
   // eslint-disable-next-line @typescript-eslint/naming-convention
   guild_id: string;
   channels: { status: string; id: string }[];
  },
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  p.push(redis.channelStatus.delAll(data.guild_id));

  data.channels.forEach((c) => {
   if (!c.status.length) return;
   p.push(redis.channelStatus.set(data.guild_id, c.id, c.status));
  });
  return p;
 },

 [GatewayDispatchEvents.ChannelInfo]: (
  data: GatewayChannelInfoDispatchData,
  _: number | undefined,
  p: Promise<unknown>[] = [],
 ) => {
  data.channels.forEach((c) => {
   if (c.status) p.push(redis.channelStatus.set(data.guild_id, c.id, c.status));
  });

  return p;
 },

 [GatewayDispatchEvents.VoiceChannelStartTimeUpdate]: async (
  _0: GatewayVoiceChannelStartTimeUpdateDispatchData,
  _1: number | undefined,
  p: Promise<unknown>[] = [],
 ) => p,
} as const;
