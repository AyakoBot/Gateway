/* eslint-disable no-console */
import { GatewayDispatchEvents, type GatewayDispatchPayload } from '@discordjs/core';

import { currentBot } from '../../Cluster/bots.js';
import { api, cache } from '../Client.js';

import { guildLogEmbed } from './embed.js';
import GuildTracker, { GuildChange, type GuildSummary } from './GuildTracker.js';

const tracker = new GuildTracker();
const thread = currentBot?.guildLogThread;
const webhookId = process.env.guildActionWebhookId;
const webhookToken = process.env.guildActionWebhookToken;

const summaryOf = (guild: {
 name?: string;
 member_count?: number;
 owner_id?: string;
}): GuildSummary => ({
 name: guild.name ?? '',
 memberCount: guild.member_count ?? null,
 ownerId: guild.owner_id ?? null,
});

const post = (change: GuildChange, guildId: string, summary: GuildSummary | null) => {
 if (!thread || !webhookId || !webhookToken || !cache.user) return;

 api.webhooks
  .execute(webhookId, webhookToken, {
   thread_id: thread,
   allowed_mentions: { parse: [] },
   embeds: [guildLogEmbed(change, cache.user.id, guildId, summary, tracker.total, new Date())],
  })
  .catch((err) => console.error('[GuildLog] Posting failed:', err));
};

export default (data: GatewayDispatchPayload, shardId: number) => {
 if (!thread) return;

 switch (data.t) {
  case GatewayDispatchEvents.Ready:
   tracker.ready(
    shardId,
    data.d.guilds.map((guild) => guild.id),
   );
   break;
  case GatewayDispatchEvents.GuildCreate: {
   const change = tracker.created(shardId, data.d.id, summaryOf(data.d));
   if (change === GuildChange.Joined) post(change, data.d.id, tracker.summaryOf(data.d.id));
   break;
  }
  case GatewayDispatchEvents.GuildUpdate:
   tracker.updated(data.d.id, { name: data.d.name, ownerId: data.d.owner_id });
   break;
  case GatewayDispatchEvents.GuildDelete: {
   const { change, summary } = tracker.deleted(data.d.id, !!data.d.unavailable);
   if (change === GuildChange.Left) post(change, data.d.id, summary);
   break;
  }
  default:
   break;
 }
};
