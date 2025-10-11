import type {
 APIApplicationCommand,
 APIApplicationCommandPermission,
 APIAuditLogEntry,
 APIAutoModerationRule,
 APIBan,
 APIEmoji,
 APIGuild,
 APIGuildChannel,
 APIGuildIntegration,
 APIGuildMember,
 APIGuildScheduledEvent,
 APIGuildWelcomeScreen,
 APIInvite,
 APIMessage,
 APIReaction,
 APIRole,
 APISoundboardSound,
 APIStageInstance,
 APISticker,
 APIThreadChannel,
 APIThreadMember,
 APIUser,
 APIVoiceState,
 APIWebhook,
} from 'discord-api-types/v10';
import type Redis from 'ioredis';
import type { ChainableCommander } from 'ioredis';

import type { RAuditLog } from '../auditlog';
import type { RAutomod } from '../automod';
import type { RBan } from '../ban';
import type { RChannel, RChannelTypes } from '../channel';
import type { RCommand } from '../command';
import type { RCommandPermission } from '../commandPermission';
import type { REmoji } from '../emoji';
import type { REvent } from '../event';
import type { RGuild } from '../guild';
import type { RGuildCommand } from '../guildCommand';
import type { RIntegration } from '../integration';
import type { RInvite } from '../invite';
import type { RMember } from '../member';
import type { RMessage } from '../message';
import type { RReaction } from '../reaction';
import type { RRole } from '../role';
import type { RSoundboardSound } from '../soundboard';
import type { RStageInstance } from '../stage';
import type { RSticker } from '../sticker';
import type { RThread } from '../thread';
import type { RThreadMember } from '../threadMember';
import type { RUser } from '../user';
import type { RVoiceState } from '../voice';
import type { RWebhook } from '../webhook';
import type { RWelcomeScreen } from '../welcomeScreen';

type GuildBasedCommand<T extends boolean> = T extends true
 ? APIApplicationCommand & { guild_id: string }
 : APIApplicationCommand;

export type DeriveRFromAPI<T, K extends boolean> = T extends APIThreadChannel & {
 guild_id: string;
 member_id: string;
}
 ? RThread
 : T extends APIGuildIntegration & {
      user_id: string;
      guild_id: string;
     }
   ? RIntegration
   : T extends APIApplicationCommand
     ? K extends true
       ? RGuildCommand
       : RCommand
     : T extends APIUser
       ? RUser
       : T extends GuildBasedCommand<K>
         ? K extends true
           ? RGuildCommand
           : RCommand
         : T extends APIGuild
           ? RGuild
           : T extends APISoundboardSound
             ? RSoundboardSound
             : T extends APIGuildChannel<RChannelTypes>
               ? RChannel
               : T extends APISticker
                 ? RSticker
                 : T extends APIStageInstance
                   ? RStageInstance
                   : T extends APIRole
                     ? RRole
                     : T extends APIVoiceState
                       ? RVoiceState
                       : T extends APIAutoModerationRule
                         ? RAutomod
                         : T extends APIBan
                           ? RBan
                           : T extends APIInvite
                             ? RInvite
                             : T extends APIGuildMember
                               ? RMember
                               : T extends APIGuildScheduledEvent
                                 ? REvent
                                 : T extends APIWebhook
                                   ? RWebhook
                                   : T extends APIEmoji
                                     ? REmoji
                                     : T extends APIThreadChannel
                                       ? RThread
                                       : T extends APIApplicationCommandPermission
                                         ? RCommandPermission
                                         : T extends APIMessage
                                           ? RMessage
                                           : T extends APIGuildIntegration
                                             ? RIntegration
                                             : T extends APIReaction
                                               ? RReaction
                                               : T extends APIThreadMember
                                                 ? RThreadMember
                                                 : T extends APIAuditLogEntry
                                                   ? RAuditLog
                                                   : T extends APIGuildWelcomeScreen
                                                     ? RWelcomeScreen
                                                     : never;

export default abstract class Cache<
 T extends
  | APIUser
  | APIGuild
  | APISoundboardSound
  | GuildBasedCommand<K>
  | APISticker
  | APIStageInstance
  | APIRole
  | APIVoiceState
  | APIAutoModerationRule
  | APIBan
  | APIInvite
  | APIGuildMember
  | APIGuildScheduledEvent
  | APIEmoji
  | APIGuildChannel<RChannelTypes>
  | APIThreadChannel
  | APIApplicationCommandPermission
  | APIMessage
  | APIWebhook
  | APIGuildIntegration
  | APIReaction
  | APIThreadMember
  | APIAuditLogEntry
  | APIGuildWelcomeScreen,
 K extends boolean = false,
> {
 abstract keys: ReadonlyArray<keyof DeriveRFromAPI<T, K>>;

 private dedupeScript = `
 local currentKey = KEYS[1]
 local timestampKey = KEYS[2]
 local historyKey = KEYS[3]
 local newValue = ARGV[1]
 local ttl = tonumber(ARGV[2])
 local timestamp = ARGV[3]
 
 -- Function to normalize JSON by sorting keys recursively
 local function normalizeJson(jsonStr)
   local success, decoded = pcall(cjson.decode, jsonStr)
   if not success then
     return jsonStr  -- Return original if not valid JSON
   end
   
   local function sortTable(t)
     if type(t) ~= "table" then
       return t
     end
     
     local result = {}
     local keys = {}
     
     -- Collect all keys
     for k in pairs(t) do
       table.insert(keys, k)
     end
     
     -- Sort keys
     table.sort(keys, function(a, b)
       return tostring(a) < tostring(b)
     end)
     
     -- Rebuild table with sorted keys, recursively sorting nested objects
     for _, k in ipairs(keys) do
       result[k] = sortTable(t[k])
     end
     
     return result
   end
   
   local sortedTable = sortTable(decoded)
   local success2, normalizedJson = pcall(cjson.encode, sortedTable)
   return success2 and normalizedJson or jsonStr
 end
 
 local current = redis.call('GET', currentKey)
 local normalizedCurrent = current and normalizeJson(current) or nil
 local normalizedNew = normalizeJson(newValue)
 
 if normalizedCurrent == normalizedNew then
   redis.call('EXPIRE', currentKey, ttl)
   return 0
 end
 
 redis.call('SET', currentKey, newValue, 'EX', ttl)
 redis.call('SET', timestampKey, newValue, 'EX', ttl)
 redis.call('HSET', historyKey, timestampKey, timestamp)
 redis.call('HEXPIRE', historyKey, ttl, 'FIELDS', 1, timestampKey)
 return 1
  `;

 private prefix: string;
 private keystorePrefix: string;
 private historyPrefix: string;
 public redis: Redis;

 constructor(redis: Redis, type: string) {
  this.prefix = `cache:${type}`;
  this.historyPrefix = `history:${type}`;
  this.keystorePrefix = `keystore:${type}`;
  this.redis = redis;
 }

 stringToData = (data: string | null) => (data ? (JSON.parse(data) as DeriveRFromAPI<T, K>) : null);

 keystore(...ids: string[]) {
  return `${this.keystorePrefix}${ids.length ? `:${ids.join(':')}` : ''}`;
 }

 history(...ids: string[]) {
  return `${this.historyPrefix}${ids.length ? `:${ids.join(':')}` : ''}`;
 }

 key(...ids: string[]) {
  return `${this.prefix}${ids.length ? `:${ids.join(':')}` : ''}`;
 }

 abstract set(...args: [T, string, string, string]): Promise<boolean>;

 get(...ids: string[]): Promise<null | DeriveRFromAPI<T, K>> {
  return this.redis.get(this.key(...ids, 'current')).then((data) => this.stringToData(data));
 }

 getAt(time: number, ...ids: string[]): Promise<null | DeriveRFromAPI<T, K>> {
  return this.redis.get(this.key(...ids, String(time))).then((data) => this.stringToData(data));
 }

 getAll(...ids: string[]): Promise<Array<DeriveRFromAPI<T, K>>> {
  return this.getTimes(...ids).then((times) =>
   Promise.all(times.map((t) => this.getAt(Number(t), ...ids))).then((d) => d.filter((v) => !!v)),
  );
 }

 getTimes(...ids: string[]): Promise<number[]> {
  return this.redis.hkeys(this.key(...ids)).then((times) => times.map((t) => Number(t)));
 }

 private setKeystore(
  pipeline: ChainableCommander,
  ttl: number = 604800,
  keystoreKeys: string[],
  keys: string[],
 ) {
  pipeline.hset(this.keystore(...keystoreKeys), this.key(...keys), 0);
  pipeline.call('hexpire', this.keystore(...keystoreKeys), this.key(...keys), ttl);
 }

 async setValue(
  value: DeriveRFromAPI<T, K>,
  keystoreIds: string[],
  ids: string[],
  ttl: number = 604800,
 ) {
  const now = Date.now();
  const valueStr = JSON.stringify(value);
  const currentKey = this.key(...ids, 'current');
  const timestampKey = this.key(...ids, String(now));
  const historyKey = this.history(...ids);

  const result = await this.redis.eval(
   this.dedupeScript,
   3,
   currentKey,
   timestampKey,
   historyKey,
   valueStr,
   ttl,
   now,
  );

  if (result === 1 || keystoreIds.length > 0) {
   const pipeline = this.redis.pipeline();
   this.setKeystore(pipeline, ttl, keystoreIds, ids);
   return pipeline.exec();
  }

  return [];
 }

 del(...ids: string[]) {
  return this.redis.del(this.key(...ids, 'current'));
 }

 abstract apiToR(...args: [T, string, string, string]): DeriveRFromAPI<T, K> | false;
}
