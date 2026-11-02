import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DedupeVerdict, leaveVerdict } from './guildLeave.js';

test('the last family bot leaving carries on to the wipe', () => {
 assert.equal(leaveVerdict(1, 0), DedupeVerdict.Process);
});

test('a bot leaving while another family bot stays is dropped', () => {
 assert.equal(leaveVerdict(1, 1), DedupeVerdict.Drop);
 assert.equal(leaveVerdict(1, 9), DedupeVerdict.Drop);
});

test('an evicted presence set is dropped, because the leaving bot was not in it', () => {
 assert.equal(leaveVerdict(0, 0), DedupeVerdict.Drop);
});

test('an unreadable reply is dropped', () => {
 assert.equal(leaveVerdict(1, null), DedupeVerdict.Drop);
 assert.equal(leaveVerdict(1, undefined), DedupeVerdict.Drop);
 assert.equal(leaveVerdict(null, 0), DedupeVerdict.Drop);
 assert.equal(leaveVerdict(undefined, 0), DedupeVerdict.Drop);
});

test('replies read back as strings are understood', () => {
 assert.equal(leaveVerdict('1', '0'), DedupeVerdict.Process);
 assert.equal(leaveVerdict('1', '2'), DedupeVerdict.Drop);
});
