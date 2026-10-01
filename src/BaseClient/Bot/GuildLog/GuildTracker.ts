export enum GuildChange {
 Ignored = 'ignored',
 Startup = 'startup',
 Returned = 'returned',
 Joined = 'joined',
 Outage = 'outage',
 Left = 'left',
}

export interface GuildSummary {
 name: string;
 memberCount: number | null;
 ownerId: string | null;
}

export default class GuildTracker {
 private readyShards = new Set<number>();
 private expected = new Set<string>();
 private known = new Map<string, GuildSummary>();

 get total(): number {
  return this.known.size + this.expected.size;
 }

 summaryOf = (guildId: string): GuildSummary | null => this.known.get(guildId) ?? null;

 ready = (shardId: number, guildIds: string[]): void => {
  this.readyShards.add(shardId);
  guildIds.filter((id) => !this.known.has(id)).forEach((id) => this.expected.add(id));
 };

 created = (shardId: number, guildId: string, summary: GuildSummary): GuildChange => {
  const change = this.createdChange(shardId, guildId);

  this.expected.delete(guildId);
  this.known.set(guildId, summary);
  return change;
 };

 updated = (guildId: string, patch: Partial<GuildSummary>): void => {
  const current = this.known.get(guildId);
  if (current) this.known.set(guildId, { ...current, ...patch });
 };

 deleted = (
  guildId: string,
  unavailable: boolean,
 ): { change: GuildChange; summary: GuildSummary | null } => {
  const summary = this.known.get(guildId) ?? null;
  if (unavailable) return { change: GuildChange.Outage, summary };

  this.known.delete(guildId);
  this.expected.delete(guildId);
  return { change: GuildChange.Left, summary };
 };

 private createdChange = (shardId: number, guildId: string): GuildChange => {
  if (!this.readyShards.has(shardId)) return GuildChange.Ignored;
  if (this.expected.has(guildId)) return GuildChange.Startup;
  if (this.known.has(guildId)) return GuildChange.Returned;
  return GuildChange.Joined;
 };
}
