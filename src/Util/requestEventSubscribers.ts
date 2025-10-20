import type { APIGuildMember, APIGuildScheduledEvent, APIUser } from 'discord-api-types/v10';

import { api } from '../BaseClient/Bot/Client.js';

/**
 * Fetches all event subscribers for a given guild scheduled event.
 * @param event The guild scheduled event to fetch subscribers for.
 * @returns An array of objects containing the member and user of each subscriber,
 * along with the ID of the guild scheduled event.
 */
export default async (event: APIGuildScheduledEvent) => {
 const users: { member: APIGuildMember | undefined; user: APIUser }[] = [];

 const fetches = Math.ceil(Number(event.user_count) / 100);
 for (let i = 0; i < fetches; i += 1) {
  const u = await api.guilds.getScheduledEventUsers(event.guild_id, event.id, {
   limit: 100,
   with_member: true,
   after: users.at(-1)?.user.id,
  });

  if ('message' in u) return [];
  u.forEach((m) => users.push({ member: m.member, user: m.user }));
 }

 return users.map((u) => ({
  ...u,
  guildScheduledEventId: event.id,
 }));
};
