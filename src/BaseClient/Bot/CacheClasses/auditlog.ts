import type { APIAuditLogEntry } from 'discord-api-types/v10';
import type Redis from 'ioredis';

import Cache from './base.js';

export type RAuditLog = APIAuditLogEntry & { guild_id: string };

export const RAuditLogKeys = [
 'guild_id',
 'target_id',
 'user_id',
 'id',
 'reason',
 'action_type',
 'changes',
 'options',
] as const;

export default class AuditLogCache extends Cache<APIAuditLogEntry> {
 public keys = RAuditLogKeys;

 constructor(redis: Redis) {
  super(redis, 'auditlogs');
 }

 async set(data: APIAuditLogEntry, guildId: string) {
  const rData = this.apiToR(data, guildId);
  if (!rData) return false;

  await this.setValue(rData, [rData.guild_id], [rData.id]);
  return true;
 }

 async get(automodId: string) {
  return super.get(automodId);
 }

 apiToR(data: APIAuditLogEntry, guildId: string) {
  const keysNotToCache = Object.keys(data).filter(
   (key): key is keyof typeof data => !this.keys.includes(key),
  );

  keysNotToCache.forEach((k) => delete data[k]);
  const rData = structuredClone(data) as RAuditLog;
  rData.guild_id = guildId;

  return rData;
 }
}
