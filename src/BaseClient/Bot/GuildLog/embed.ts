import type { APIEmbed } from 'discord-api-types/v10';

import { GuildChange, type GuildSummary } from './GuildTracker.js';

const joinColor = 0x00ff00;
const leaveColor = 0xff0000;
const unknown = 'Unknown';

export const guildLogEmbed = (
 change: GuildChange,
 botUserId: string,
 guildId: string,
 summary: GuildSummary | null,
 total: number,
 at: Date,
): APIEmbed => {
 const joined = change === GuildChange.Joined;

 return {
  description: joined ? `<@${botUserId}> joined a new Guild` : `<@${botUserId}> left a Guild`,
  color: joined ? joinColor : leaveColor,
  fields: [
   { name: 'Guild Name', value: summary?.name || unknown, inline: true },
   { name: 'Guild ID', value: guildId, inline: true },
   {
    name: 'Membercount',
    value: summary?.memberCount != null ? String(summary.memberCount) : unknown,
    inline: true,
   },
   { name: 'Guild Owner ID', value: summary?.ownerId || unknown, inline: true },
  ],
  footer: { text: `Total Guilds: ${total.toLocaleString('en-US')}` },
  timestamp: at.toISOString(),
 };
};
