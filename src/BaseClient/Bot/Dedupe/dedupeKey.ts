import { GatewayDispatchEvents, type GatewayDispatchPayload } from '@discordjs/core';

const hash = (input: string): string => {
 let h = 0x811c9dc5;
 for (let i = 0; i < input.length; i += 1) {
  h ^= input.charCodeAt(i);
  h = Math.imul(h, 0x01000193);
 }
 return (h >>> 0).toString(36);
};

const contentHash = (d: unknown): string => hash(JSON.stringify(d));

export default (data: GatewayDispatchPayload): string | null => {
 const { t } = data;
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const d = data.d as any;

 switch (t) {
  case GatewayDispatchEvents.MessageCreate:
  case GatewayDispatchEvents.MessageDelete:
   return `${t}:${d.id}`;
  case GatewayDispatchEvents.MessageUpdate:
   return `${t}:${d.id}:${d.edited_timestamp ?? contentHash(d)}`;
  case GatewayDispatchEvents.MessageDeleteBulk:
   return `${t}:${hash([...(d.ids ?? [])].sort().join(','))}`;
  case GatewayDispatchEvents.MessageReactionAdd:
  case GatewayDispatchEvents.MessageReactionRemove:
   return `${t}:${d.message_id}:${d.user_id}:${d.emoji?.id ?? d.emoji?.name}`;
  case GatewayDispatchEvents.MessageReactionRemoveAll:
   return `${t}:${d.message_id}`;
  case GatewayDispatchEvents.MessageReactionRemoveEmoji:
   return `${t}:${d.message_id}:${d.emoji?.id ?? d.emoji?.name}`;
  case GatewayDispatchEvents.GuildMemberAdd:
   return `${t}:${d.guild_id}:${d.user?.id}:add`;
  case GatewayDispatchEvents.GuildMemberRemove:
   return `${t}:${d.guild_id}:${d.user?.id}:remove`;
  case GatewayDispatchEvents.GuildBanAdd:
  case GatewayDispatchEvents.GuildBanRemove:
   return `${t}:${d.guild_id}:${d.user?.id}`;
  case GatewayDispatchEvents.ChannelPinsUpdate:
   return `${t}:${d.channel_id}:${d.last_pin_timestamp ?? ''}`;
  default:
   break;
 }

 const entityId = d?.id ?? d?.channel_id ?? d?.guild_id ?? '';
 return `${t}:${entityId}:${contentHash(d)}`;
};
