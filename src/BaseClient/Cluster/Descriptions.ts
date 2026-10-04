import splitByThousand from '../../Util/splitByThousand.js';

const counted = (value: number, one: string, many: string) =>
 `\`${splitByThousand(value)} ${value === 1 ? one : many}\``;

const pluginBio = (tagline: string, guilds: number, members: number, users?: number) =>
 `**${tagline}**
Installed on ${counted(guilds, 'Server', 'Servers')}${
  users === undefined ? '' : ` / ${counted(users, 'User', 'Users')}`
 }
Managing ${counted(members, 'Member', 'Members')}

https://ayakobot.com
https://support.ayakobot.com
`;

export default (
 guilds: number,
 members: number,
 // eslint-disable-next-line @typescript-eslint/naming-convention
 app?: { approximate_user_install_count?: number },
) => ({
 MAIN_TOKEN: `**Your go-to, free-to-access, management, and automation Discord Bot!**
Installed on \`${splitByThousand(guilds)} Servers\` / \`${splitByThousand(app?.approximate_user_install_count ?? 0)} Users\` 
Managing \`${splitByThousand(members)} Members\`

https://ayakobot.com
https://support.ayakobot.com
`,
 TICKET_TOKEN: pluginBio(
  'Ayako Ticketing: support tickets in channels, threads or DMs',
  guilds,
  members,
 ),
 ECONOMY_TOKEN: pluginBio(
  'Ayako Economy: a server currency with a shop and role rewards',
  guilds,
  members,
 ),
 CUSTOM_ROLES_TOKEN: pluginBio(
  'Ayako Custom Roles: members create and style their own roles',
  guilds,
  members,
 ),
 CONFESSIONS_TOKEN: pluginBio(
  'Ayako Confessions: anonymous confessions with staff review',
  guilds,
  members,
 ),
 WELCOME_TOKEN: pluginBio(
  'Ayako Welcome: welcome and goodbye messages in your own designs',
  guilds,
  members,
 ),
 INFO_TOKEN: pluginBio(
  'Ayako Info: look up users, servers, roles and more',
  guilds,
  members,
  app?.approximate_user_install_count ?? 0,
 ),
 AFK_TOKEN: pluginBio('Ayako AFK: AFK statuses that answer mentions for you', guilds, members),
 REMINDERS_TOKEN: pluginBio(
  'Ayako Reminders: reminders delivered to your DMs',
  guilds,
  members,
  app?.approximate_user_install_count ?? 0,
 ),
});
