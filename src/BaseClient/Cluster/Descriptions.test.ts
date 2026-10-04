import assert from 'node:assert/strict';
import { test } from 'node:test';

import descriptions from './Descriptions.js';

const pluginKeys = [
 'TICKET_TOKEN',
 'ECONOMY_TOKEN',
 'CUSTOM_ROLES_TOKEN',
 'CONFESSIONS_TOKEN',
 'WELCOME_TOKEN',
 'INFO_TOKEN',
 'AFK_TOKEN',
 'REMINDERS_TOKEN',
] as const;

// eslint-disable-next-line @typescript-eslint/naming-convention
const app = { approximate_user_install_count: 3 };

test('the main bot bio keeps its template', () => {
 assert.equal(
  descriptions(8520, 1234567, app).MAIN_TOKEN,
  '**Your go-to, free-to-access, management, and automation Discord Bot!**\n' +
   'Installed on `8,520 Servers` / `3 Users` \n' +
   'Managing `1,234,567 Members`\n\n' +
   'https://ayakobot.com\nhttps://support.ayakobot.com\n',
 );
});

test('plugin bios use singular and plural counts', () => {
 const one = descriptions(1, 1, app).ECONOMY_TOKEN;
 const many = descriptions(2, 2, app).ECONOMY_TOKEN;

 assert.ok(one.includes('Installed on `1 Server`\n'));
 assert.ok(one.includes('Managing `1 Member`\n'));
 assert.ok(many.includes('Installed on `2 Servers`\n'));
 assert.ok(many.includes('Managing `2 Members`\n'));
});

const userInstallable: readonly string[] = ['INFO_TOKEN', 'REMINDERS_TOKEN'];

test('only user-installable bots show user installs', () => {
 const bios = descriptions(4, 821, app);

 pluginKeys.forEach((key) => {
  const shown = bios[key].includes('Installed on `4 Servers` / `3 Users`\n');
  assert.equal(shown, userInstallable.includes(key), key);
 });
});

test('plugin bios say Managing and fit the 400 character limit', () => {
 const bios = descriptions(123456789, 987654321, { approximate_user_install_count: 12345678 });

 pluginKeys.forEach((key) => {
  assert.ok(bios[key].includes('Managing `'), key);
  assert.ok(!bios[key].includes('Serving'), key);
  assert.ok(bios[key].length <= 400, `${key} is ${bios[key].length} characters`);
 });
});
