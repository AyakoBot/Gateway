import assert from 'node:assert/strict';
import { test } from 'node:test';

import { baseKey, DedupeLens, priorityOf } from './bots.js';

test('message events let the content bot beat a members-only bot', () => {
 assert.ok(
  priorityOf('TICKET_TOKEN', DedupeLens.Content) <
   priorityOf('CUSTOM_ROLES_TOKEN', DedupeLens.Content),
 );
});

test('member events keep the members bot ahead of the content bot', () => {
 assert.ok(
  priorityOf('CUSTOM_ROLES_TOKEN', DedupeLens.Members) <
   priorityOf('TICKET_TOKEN', DedupeLens.Members),
 );
});

test('the main bot outranks every plugin bot under both lenses', () => {
 [DedupeLens.Members, DedupeLens.Content].forEach((lens) => {
  assert.equal(priorityOf(baseKey, lens), 0);
  assert.ok(priorityOf('TICKET_TOKEN', lens) > 0);
 });
});
