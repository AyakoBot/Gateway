/* eslint-disable max-len */
import type {
 APIInteraction,
 APISubscription,
 ChannelType,
 GatewayActivity,
 GatewayAutoModerationActionExecutionDispatchData,
 GatewayDispatchEvents,
 GatewayEntitlementCreateDispatchData,
 GatewayEntitlementDeleteDispatchData,
 GatewayEntitlementUpdateDispatchData,
 GatewayGuildAuditLogEntryCreateDispatchData,
 GatewayGuildSoundboardSoundDeleteDispatchData,
 GatewayIntegrationDeleteDispatchData,
 GatewayInviteCreateDispatchData,
 GatewayInviteDeleteDispatchData,
 GatewayMessageDeleteDispatchData,
 GatewayPresenceClientStatus,
 GatewayReadyDispatchData,
 GatewayResumeData,
 GatewayStageInstanceDeleteDispatchData,
 PresenceUpdateReceiveStatus,
 VoiceChannelEffectSendAnimationType,
} from 'discord-api-types/v10';
import type {
 RAutomod,
 RBan,
 RChannel,
 RCommandPermission,
 REmoji,
 REvent,
 RGuild,
 RIntegration,
 RInvite,
 RMember,
 RMessage,
 RReaction,
 RRole,
 RSoundboardSound,
 RStageInstance,
 RThread,
 RThreadMember,
 RUser,
 RVoiceState,
} from 'src/Typings/Redis.js';

import cacheDB from '../BaseClient/Bot/Redis.js';

interface EmitterTypeMap {
 // Application Commands
 [GatewayDispatchEvents.ApplicationCommandPermissionsUpdate]: {
  before: RCommandPermission[];
  after: RCommandPermission[];
  guild: RGuild | { id: string };
 };

 // Auto Moderation
 [GatewayDispatchEvents.AutoModerationActionExecution]: GatewayAutoModerationActionExecutionDispatchData;

 [GatewayDispatchEvents.AutoModerationRuleCreate]: RAutomod;
 [GatewayDispatchEvents.AutoModerationRuleDelete]: RAutomod;
 [GatewayDispatchEvents.AutoModerationRuleUpdate]: {
  before: RAutomod | null;
  after: RAutomod;
  guild: RGuild | { id: string };
 };

 // Channels
 [GatewayDispatchEvents.ChannelCreate]: RChannel;
 [GatewayDispatchEvents.ChannelDelete]: RChannel;
 [GatewayDispatchEvents.ChannelUpdate]: {
  before: RChannel | null;
  after: RChannel;
  guild: RGuild | { id: string };
 };
 [GatewayDispatchEvents.ChannelPinsUpdate]: {
  guild: RGuild | { id: string } | null;
  channel: RChannel | { id: string };
  last_pin_timestamp?: string | null;
 };

 //  Entitlements
 [GatewayDispatchEvents.EntitlementCreate]: GatewayEntitlementCreateDispatchData;
 [GatewayDispatchEvents.EntitlementDelete]: GatewayEntitlementDeleteDispatchData;
 [GatewayDispatchEvents.EntitlementUpdate]: GatewayEntitlementUpdateDispatchData;

 // Audit Log
 [GatewayDispatchEvents.GuildAuditLogEntryCreate]: GatewayGuildAuditLogEntryCreateDispatchData;

 // Bans
 [GatewayDispatchEvents.GuildBanAdd]: RBan;
 [GatewayDispatchEvents.GuildBanRemove]: RBan;

 // Guilds
 [GatewayDispatchEvents.GuildCreate]: RGuild;
 [GatewayDispatchEvents.GuildDelete]: RGuild;
 [GatewayDispatchEvents.GuildUpdate]: {
  before: RGuild | null;
  after: RGuild;
 };

 // Emojis
 [GatewayDispatchEvents.GuildEmojisUpdate]: {
  before: REmoji[];
  after: REmoji[];
  guild: RGuild | { id: string };
 };

 // Integrations
 [GatewayDispatchEvents.GuildIntegrationsUpdate]: RGuild | { id: string };

 // Members
 [GatewayDispatchEvents.GuildMemberAdd]: RMember;
 [GatewayDispatchEvents.GuildMemberRemove]:
  | RMember
  | { guild: RGuild | { id: string }; user: RUser };
 [GatewayDispatchEvents.GuildMemberUpdate]: {
  before: RMember | null;
  after: RMember;
  guild: RGuild | { id: string };
 };

 // Roles
 [GatewayDispatchEvents.GuildRoleCreate]: RRole;
 [GatewayDispatchEvents.GuildRoleDelete]: RRole;
 [GatewayDispatchEvents.GuildRoleUpdate]: {
  before: RRole | null;
  after: RRole;
  guild: RGuild | { id: string };
 };

 // Scheduled Events
 [GatewayDispatchEvents.GuildScheduledEventCreate]: REvent;
 [GatewayDispatchEvents.GuildScheduledEventDelete]: REvent;
 [GatewayDispatchEvents.GuildScheduledEventUpdate]: {
  before: REvent | null;
  after: REvent;
  guild: RGuild | { id: string };
 };
 [GatewayDispatchEvents.GuildScheduledEventUserAdd]: {
  event: REvent | { id: string };
  user: RUser | { id: string };
  guild: RGuild | { id: string };
 };
 [GatewayDispatchEvents.GuildScheduledEventUserRemove]: {
  event: REvent | { id: string };
  user: RUser | { id: string };
  guild: RGuild | { id: string };
 };

 // Soundboard
 [GatewayDispatchEvents.GuildSoundboardSoundCreate]: RSoundboardSound;
 [GatewayDispatchEvents.GuildSoundboardSoundDelete]:
  | RSoundboardSound
  | GatewayGuildSoundboardSoundDeleteDispatchData;
 [GatewayDispatchEvents.GuildSoundboardSoundUpdate]: {
  before: RSoundboardSound | null;
  after: RSoundboardSound;
  guild: RGuild | { id: string };
 };
 [GatewayDispatchEvents.GuildSoundboardSoundsUpdate]: {
  before: RSoundboardSound[];
  after: RSoundboardSound[];
  guild: RGuild | { id: string };
 };
 [GatewayDispatchEvents.SoundboardSounds]: {
  sounds: RSoundboardSound[];
  guild: RGuild | { id: string };
 };

 // Stickers
 [GatewayDispatchEvents.GuildStickersUpdate]: {
  before: REmoji[];
  after: REmoji[];
  guild: RGuild | { id: string };
 };

 // Integrations
 [GatewayDispatchEvents.IntegrationCreate]: RIntegration;
 [GatewayDispatchEvents.IntegrationDelete]: RIntegration | GatewayIntegrationDeleteDispatchData;
 [GatewayDispatchEvents.IntegrationUpdate]: {
  before: RIntegration | null;
  after: RIntegration;
  guild: RGuild | { id: string };
 };

 // Invites
 [GatewayDispatchEvents.InviteCreate]: RInvite | GatewayInviteCreateDispatchData;
 [GatewayDispatchEvents.InviteDelete]: RInvite | GatewayInviteDeleteDispatchData;

 // Messages
 [GatewayDispatchEvents.MessageCreate]: RMessage;
 [GatewayDispatchEvents.MessageDelete]: RMessage | GatewayMessageDeleteDispatchData;
 [GatewayDispatchEvents.MessageDeleteBulk]: {
  messages: (RMessage | { id: string })[];
  channel: RChannel | { id: string };
  guild?: RGuild | { id: string };
 };
 [GatewayDispatchEvents.MessageUpdate]: {
  before: RMessage | null;
  after: RMessage;
  guild?: RGuild | { id: string };
 };

 // Polls
 [GatewayDispatchEvents.MessagePollVoteAdd]: {
  user: RUser | { id: string };
  channel: RChannel | { id: string };
  message: RMessage | { id: string };
  guild: RGuild | { id: string } | null;
  answer_id: number;
 };
 [GatewayDispatchEvents.MessagePollVoteRemove]: {
  user: RUser | { id: string };
  channel: RChannel | { id: string };
  message: RMessage | { id: string };
  guild: RGuild | { id: string } | null;
  answer_id: number;
 };

 // Reactions
 [GatewayDispatchEvents.MessageReactionAdd]: {
  member: RMember | null;
  user: RUser | { id: string };

  message: RMessage | { id: string };
  channel: RChannel | { id: string };
  guild: RGuild | { id: string } | null;
  author: RUser | { id: string };

  burst_colors?: string[];
  emoji: string | `${string}:${string}` | `a:${string}:${string}`;
 };
 [GatewayDispatchEvents.MessageReactionRemove]: {
  user: RUser | { id: string };

  message: RMessage | { id: string };
  channel: RChannel | { id: string };
  guild: RGuild | { id: string } | null;

  emoji: string | `${string}:${string}` | `a:${string}:${string}`;
 };
 [GatewayDispatchEvents.MessageReactionRemoveAll]: {
  reactions: RReaction[];
  channel: RChannel | { id: string };
  message: RMessage | { id: string };
  guild: RGuild | { id: string } | null;
 };
 [GatewayDispatchEvents.MessageReactionRemoveEmoji]: {
  reactions: RReaction[];
  channel: RChannel | { id: string };
  message: RMessage | { id: string };
  guild: RGuild | { id: string } | null;
  emoji: string | `${string}:${string}` | `a:${string}:${string}`;
 };

 // Presence
 [GatewayDispatchEvents.PresenceUpdate]: {
  user: RUser;
  status?: PresenceUpdateReceiveStatus;
  activities?: GatewayActivity[];
  client_status?: GatewayPresenceClientStatus;
  guild: RGuild | { id: string } | null;
 };

 // Shard Events
 [GatewayDispatchEvents.Ready]: { user: RUser; version: number; session: string } & Omit<
  GatewayReadyDispatchData,
  'v' | 'user' | 'session_id' | 'resume_gateway_url'
 >;
 [GatewayDispatchEvents.Resumed]: GatewayResumeData;

 // Stages
 [GatewayDispatchEvents.StageInstanceCreate]: RStageInstance;
 [GatewayDispatchEvents.StageInstanceDelete]:
  | RStageInstance
  | GatewayStageInstanceDeleteDispatchData;
 [GatewayDispatchEvents.StageInstanceUpdate]: {
  before: RStageInstance | null;
  after: RStageInstance;
  guild: RGuild | { id: string };
 };

 // Subscriptions
 [GatewayDispatchEvents.SubscriptionCreate]: APISubscription;
 [GatewayDispatchEvents.SubscriptionDelete]: APISubscription;
 [GatewayDispatchEvents.SubscriptionUpdate]: APISubscription;

 // Threads

 [GatewayDispatchEvents.ThreadCreate]: {
  thread: RThread;
  guild: RGuild | { id: string };
  newly_created?: boolean;
 };
 [GatewayDispatchEvents.ThreadDelete]: {
  thread: RThread | { id: string };
  guild: RGuild | { id: string };
  parent: RChannel | { id: string };
  members: RThreadMember[];
  messages: RMessage[];
  type: ChannelType;
 };
 [GatewayDispatchEvents.ThreadUpdate]: {
  before: RThread | null;
  after: RThread;
  guild: RGuild | { id: string };
 };
 [GatewayDispatchEvents.ThreadListSync]: {
  guild: RGuild | { id: string };
  parents: (RChannel | { id: string })[]; // if empty; entire guild
  threads: RThread[];
  members: RThreadMember[];
 };
 [GatewayDispatchEvents.ThreadMemberUpdate]: {
  before: RThreadMember | null;
  after: RThreadMember;
  guild: RGuild | { id: string };
 };
 [GatewayDispatchEvents.ThreadMembersUpdate]: {
  guild: RGuild | { id: string };
  members: number;
  added: RThreadMember[];
  removed: (RThreadMember | { id: string })[];
  thread: RThread | { id: string };
 };

 // Typing
 [GatewayDispatchEvents.TypingStart]: {
  channel: RChannel | { id: string };
  guild: RGuild | { id: string } | null;
  user: RUser | { id: string };
  timestamp: number;
  member: RMember | null;
 };

 // User
 [GatewayDispatchEvents.UserUpdate]: { before: RUser | null; after: RUser };

 // Voice Channel Effects
 [GatewayDispatchEvents.VoiceChannelEffectSend]: {
  channel: RChannel | { id: string };
  guild: RGuild | { id: string };
  user: RUser | { id: string };
  emoji: string | `${string}:${string}` | `a:${string}:${string}` | null;
  animation_type?: VoiceChannelEffectSendAnimationType | null;
  animation_id?: number;
  sound_id?: string | number;
  sound_volume?: number;
 };
 [GatewayDispatchEvents.VoiceServerUpdate]: {
  token: string;
  guild: RGuild | { id: string };
  endpoint: string | null;
 };
 [GatewayDispatchEvents.VoiceStateUpdate]: {
  guild: RGuild | { id: string };
  channel: RChannel | { id: string } | null;
  before: RVoiceState | null;
  after: RVoiceState;
  user: RUser | { id: string };
 };

 // Webhooks
 [GatewayDispatchEvents.WebhooksUpdate]: {
  guild: RGuild | { id: string };
  channel: RChannel | { id: string };
 };

 // Interactions
 [GatewayDispatchEvents.InteractionCreate]: APIInteraction;

 // unused
 [GatewayDispatchEvents.GuildMembersChunk]: unknown;
}

type MissingEvents = Exclude<GatewayDispatchEvents, keyof EmitterTypeMap>;

type CheckAllEventsCovered = MissingEvents extends never ? true : never;
const allEventsCovered: CheckAllEventsCovered = true;

// @ts-expect-error ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ignore = allEventsCovered;

const emit = <T extends keyof EmitterTypeMap>(type: T, data: EmitterTypeMap[T]) =>
 cacheDB.publish(type, JSON.stringify(data));

export default emit;
