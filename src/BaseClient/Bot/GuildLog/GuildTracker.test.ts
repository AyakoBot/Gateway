import assert from 'node:assert/strict';
import { test } from 'node:test';

import { guildLogEmbed } from './embed.js';
import GuildTracker, { GuildChange } from './GuildTracker.js';

const summary = (name: string) => ({ name, memberCount: 10, ownerId: 'o1' });

test('the startup burst after READY stays silent', () => {
 const tracker = new GuildTracker();
 tracker.ready(0, ['a', 'b']);

 assert.equal(tracker.created(0, 'a', summary('A')), GuildChange.Startup);
 assert.equal(tracker.created(0, 'b', summary('B')), GuildChange.Startup);
 assert.equal(tracker.total, 2);
});

test('GUILD_CREATE on a shard without a recorded READY is ignored', () => {
 const tracker = new GuildTracker();

 assert.equal(tracker.created(0, 'a', summary('A')), GuildChange.Ignored);
 tracker.ready(1, []);
 assert.equal(tracker.created(0, 'b', summary('B')), GuildChange.Ignored);
});

test('a new guild after READY is a join', () => {
 const tracker = new GuildTracker();
 tracker.ready(0, ['a']);
 tracker.created(0, 'a', summary('A'));

 assert.equal(tracker.created(0, 'n', summary('N')), GuildChange.Joined);
 assert.equal(tracker.total, 2);
});

test('an outage and its recovery stay silent', () => {
 const tracker = new GuildTracker();
 tracker.ready(0, ['a']);
 tracker.created(0, 'a', summary('A'));

 assert.equal(tracker.deleted('a', true).change, GuildChange.Outage);
 assert.equal(tracker.created(0, 'a', summary('A')), GuildChange.Returned);
 assert.equal(tracker.total, 1);
});

test('a re-identify replays known guilds silently', () => {
 const tracker = new GuildTracker();
 tracker.ready(0, ['a']);
 tracker.created(0, 'a', summary('A'));
 tracker.ready(0, ['a']);

 assert.equal(tracker.created(0, 'a', summary('A')), GuildChange.Returned);
 assert.equal(tracker.total, 1);
});

test('a real leave keeps the recorded summary and lowers the total', () => {
 const tracker = new GuildTracker();
 tracker.ready(0, ['a', 'b']);
 tracker.created(0, 'a', summary('A'));
 tracker.created(0, 'b', summary('B'));

 const left = tracker.deleted('a', false);
 assert.equal(left.change, GuildChange.Left);
 assert.equal(left.summary?.name, 'A');
 assert.equal(tracker.total, 1);
});

test('leaving an unknown guild reports a leave without a summary', () => {
 const tracker = new GuildTracker();
 tracker.ready(0, []);

 assert.deepEqual(tracker.deleted('x', false), { change: GuildChange.Left, summary: null });
});

test('the embed matches the logged format', () => {
 const at = new Date('2026-09-29T18:28:17.344Z');
 const joined = guildLogEmbed(
  GuildChange.Joined,
  'bot',
  'g1',
  { name: 'G', memberCount: 10, ownerId: 'o' },
  8509,
  at,
 );

 assert.equal(joined.description, '<@bot> joined a new Guild');
 assert.equal(joined.color, 65280);
 assert.deepEqual(
  joined.fields?.map((field) => [field.name, field.value, field.inline]),
  [
   ['Guild Name', 'G', true],
   ['Guild ID', 'g1', true],
   ['Membercount', '10', true],
   ['Guild Owner ID', 'o', true],
  ],
 );
 assert.equal(joined.footer?.text, 'Total Guilds: 8,509');
 assert.equal(joined.timestamp, '2026-09-29T18:28:17.344Z');

 const left = guildLogEmbed(GuildChange.Left, 'bot', 'g1', null, 8508, at);
 assert.equal(left.description, '<@bot> left a Guild');
 assert.equal(left.color, 16711680);
 assert.equal(left.fields?.[0]?.value, 'Unknown');
});
