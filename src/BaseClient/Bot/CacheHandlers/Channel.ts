import {
 GatewayDispatchEvents,
 type GatewayChannelCreateDispatchData,
 type GatewayChannelDeleteDispatchData,
 type GatewayChannelPinsUpdateDispatchData,
 type GatewayChannelUpdateDispatchData,
} from 'discord-api-types/v10';

import emit from '../../../Util/EventBus.js';
import type { RChannel } from '../CacheClasses/channel.js';
import RedisClient, { cache as redis } from '../Redis.js';

export default {
 [GatewayDispatchEvents.ChannelCreate]: async (data: GatewayChannelCreateDispatchData) => {
  redis.channels.set(data);

  emit(GatewayDispatchEvents.ChannelCreate, (redis.channels.apiToR(data) as RChannel)!);
 },

 [GatewayDispatchEvents.ChannelDelete]: async (data: GatewayChannelDeleteDispatchData) => {
  redis.channels.del(data.id);

  const pipeline = RedisClient.pipeline();
  const messages = await RedisClient.hgetall(redis.messages.keystore(data.guild_id));

  pipeline.hdel(
   redis.messages.keystore(data.guild_id),
   ...Object.keys(messages).filter((m) => m.includes(data.id)),
  );
  pipeline.del(...Object.keys(messages).filter((m) => m.includes(data.id)));
  pipeline.exec();

  emit(GatewayDispatchEvents.ChannelDelete, redis.channels.apiToR(data) as RChannel);
 },

 [GatewayDispatchEvents.ChannelPinsUpdate]: async (data: GatewayChannelPinsUpdateDispatchData) => {
  emit(GatewayDispatchEvents.ChannelPinsUpdate, {
   channel: (await redis.channels.get(data.channel_id)) || { id: data.channel_id },
   guild: data.guild_id ? (await redis.guilds.get(data.guild_id)) || { id: data.guild_id } : null,
   last_pin_timestamp: data.last_pin_timestamp,
  });
 },

 [GatewayDispatchEvents.ChannelUpdate]: async (data: GatewayChannelUpdateDispatchData) => {
  emit(GatewayDispatchEvents.ChannelUpdate, {
   after: data,
   before: await redis.channels.get(data.id),
   guild: (await redis.guilds.get(data.guild_id)) || { id: data.guild_id },
  });

  redis.channels.set(data);
 },
} as const;
