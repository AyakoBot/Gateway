import { gateway } from '../BaseClient/Bot/Client.js';

import calculateShardId from './calculateShardId.js';

export default async (guildId: string) =>
 gateway?.send(calculateShardId(guildId), { op: 36 as never, d: { guild_id: guildId } as never });
