import type { Client } from '@discordjs/core';
import { glob } from 'glob';
import { scheduleJob } from 'node-schedule';

import type splitByThousandType from '../../Util/splitByThousand.js';
import type { cache as CacheType } from '../Bot/Client.js';

import manager from './Manager.js';

const getCounts = () =>
 manager
  .broadcastEval(() =>
   // @ts-expect-error custom path cuz broadcastEval
   import('/app/Ayako/packages/Gateway/dist/BaseClient/Bot/Client.js').then(
    ({ cache }: { cache: typeof CacheType }) => ({
     guilds: cache.guilds,
     members: Array.from(cache.members.values()).reduce((a, b) => a + b, 0),
    }),
   ),
  )
  .then((counts) => ({
   guilds: counts.reduce((a, b) => a + b.guilds, 0),
   members: counts.reduce((a, b) => a + b.members, 0),
  }));

scheduleJob('0 */10 * * * *', async () => {
 const counts = await getCounts();

 manager.broadcastEval(
  // @ts-expect-error customn cl type
  async (cl: Client, { guilds, members }: { guilds: number; members: number }) => {
   const app = await cl.api.applications
    .getCurrent(undefined)
    .then((res) => ('message' in res ? undefined : res));

   const { default: splitByThousand }: { default: typeof splitByThousandType } = await import(
    // @ts-expect-error custom path cuz broadcastEval
    '/app/Ayako/packages/Gateway/dist/Util/splitByThousand.js'
   );

   cl.api.applications?.editCurrent({
    description: `**Your go-to, free-to-access, management, and automation Discord Bot!**
Installed on \`${splitByThousand(guilds)} Servers\` / \`${splitByThousand(app?.approximate_user_install_count ?? 0)} Users\` 
Managing \`${splitByThousand(members)} Members\`

https://ayakobot.com
https://support.ayakobot.com`,
   });
  },
  { context: counts, cluster: 0 },
 );
});

const run = () => {
 scheduleJob('0 0 */1 * * *', async () => {
  const counts = await getCounts();

  // eslint-disable-next-line no-console
  console.log(
   `| Stats: ${counts.members} Users, ${counts.guilds} Guilds, ${manager.totalShards} Shards`,
  );

  if (Buffer.from(manager.token!.split('.')[0], 'base64').toString() !== process.env.mainId) return;

  (
   await glob(
    `${process.cwd()}${process.cwd().includes('dist') ? '' : '/dist'}/BaseClient/Cluster/Stats/**/*`,
   )
  )
   .filter((fileName) => fileName.endsWith('.js'))
   .forEach(async (fileName) => {
    // eslint-disable-next-line no-console
    console.log('Running stats', fileName);

    const file = await import(fileName);

    file.default(counts.guilds, counts.members);
   });
 });
};

run();
