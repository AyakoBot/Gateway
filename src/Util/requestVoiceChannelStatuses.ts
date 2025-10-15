import { shardIdForGuildId } from 'discord-hybrid-sharding';

import { gateway } from '../BaseClient/Bot/Client.js';

export default async (guildId: string) =>
 gateway?.send(shardIdForGuildId(guildId), { op: 36 as never, d: { guild_id: guildId } as never });
