/* eslint-disable @typescript-eslint/naming-convention */
import type { APIRole } from 'discord-api-types/v10';
import type Redis from 'ioredis';

import type { PipelineBatcher } from '../Redis.js';

import Cache from './Base/Cache.js';

export type RRole = Omit<APIRole, 'icon'> & { icon_url: string | null; guild_id: string };

export const RRoleKeys = [
 'id',
 'name',
 'color',
 'colors',
 'hoist',
 'icon_url',
 'unicode_emoji',
 'position',
 'permissions',
 'managed',
 'mentionable',
 'tags',
 'flags',
 'guild_id',
] as const;

export default class RoleCache extends Cache<APIRole> {
 public keys = RRoleKeys;

 constructor(redis: Redis, batcher: PipelineBatcher) {
  super(redis, 'roles', batcher);
 }

 public static iconUrl(icon: string, roleId: string) {
  return `https://cdn.discordapp.com/role-icons/${roleId}/${icon}.${icon.startsWith('a_') ? 'gif' : 'webp'}`;
 }

 async set(data: APIRole, guildId: string) {
  const rData = this.apiToR(data, guildId);
  if (!rData) return false;
  if (!rData.guild_id || !rData.id) return false;

  await this.setValue(rData, [rData.guild_id], [rData.id]);
  return true;
 }

 async get(roleId: string) {
  return super.get(roleId);
 }

 apiToR(data: APIRole, guildId: string) {
  const keysNotToCache = Object.keys(data).filter(
   (key): key is keyof typeof data => !this.keys.includes(key as (typeof this.keys)[number]),
  );

  const rData = structuredClone(data) as unknown as RRole;
  rData.guild_id = guildId;
  rData.icon_url = data.icon ? RoleCache.iconUrl(data.icon, data.id) : null;

  keysNotToCache.forEach((k) => delete (rData as Record<string, unknown>)[k as string]);

  return rData;
 }
}
