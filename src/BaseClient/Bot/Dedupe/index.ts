/* eslint-disable no-console */
import { GatewayDispatchEvents, type GatewayDispatchPayload } from '@discordjs/core';

import { currentKey, dedupeEnabled, priorityOf } from '../../Cluster/bots.js';
import redis from '../Cache.js';

import dedupeKey from './dedupeKey.js';
import { addPresence, isShared, presenceOf, removePresence } from './presence.js';

export { startPresenceSync } from './presence.js';

const markerKey = (dk: string) => `gw:dedupe:${dk}`;
const windowMs = 10000;
const graceMs = 200;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const guildIdOf = (data: GatewayDispatchPayload): string | undefined => {
 // eslint-disable-next-line @typescript-eslint/naming-convention
 const d = data.d as { guild_id?: string; guild?: { id?: string } } | undefined;
 return d?.guild_id ?? d?.guild?.id;
};
export const maintainPresence = async (data: GatewayDispatchPayload): Promise<void> => {
 if (!dedupeEnabled) return;

 try {
  if (data.t === GatewayDispatchEvents.GuildCreate) {
   const { id } = data.d as { id?: string };
   if (id) await addPresence(id);
  } else if (data.t === GatewayDispatchEvents.GuildDelete) {
   const d = data.d as { id?: string; unavailable?: boolean };
   if (d.id && !d.unavailable) await removePresence(d.id);
  }
 } catch (err) {
  console.error('[Dedupe] presence upkeep failed:', err);
 }
};

export enum DedupeVerdict {
 Process = 'process',
 Drop = 'drop',
}

export const dedupe = async (data: GatewayDispatchPayload): Promise<DedupeVerdict> => {
 if (!dedupeEnabled) return DedupeVerdict.Process;

 const guildId = guildIdOf(data);
 if (!guildId) return DedupeVerdict.Process;
 if (!isShared(guildId)) return DedupeVerdict.Process;

 try {
  const dk = dedupeKey(data);
  if (!dk) return DedupeVerdict.Process;

  const present = await presenceOf(guildId);
  const myPriority = priorityOf(currentKey);
  const highest = present.reduce(
   (min, key) => Math.min(min, priorityOf(key)),
   Number.MAX_SAFE_INTEGER,
  );

  if (myPriority <= highest) {
   await redis.cacheDb.set(markerKey(dk), currentKey, 'PX', windowMs);
   return DedupeVerdict.Process;
  }

  await wait(graceMs);
  const won = await redis.cacheDb.set(markerKey(dk), currentKey, 'PX', windowMs, 'NX');
  return won ? DedupeVerdict.Process : DedupeVerdict.Drop;
 } catch (err) {
  console.error('[Dedupe] gate error, failing open:', err);
  return DedupeVerdict.Process;
 }
};
