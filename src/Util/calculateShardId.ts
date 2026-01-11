import { getInfo } from 'discord-hybrid-sharding';

export default (guildId: string) => Number(BigInt(guildId) >> 22n) % getInfo().TOTAL_SHARDS;
