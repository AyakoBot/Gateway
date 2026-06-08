import splitByThousand from '../../Util/splitByThousand.js';

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
});
