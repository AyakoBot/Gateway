import type { Client } from '@discordjs/core';
import { getInfo } from 'discord-hybrid-sharding';
import { glob } from 'glob';
import { scheduleJob } from 'node-schedule';

import type splitByThousandType from '../../Util/splitByThousand.js';
import type { cache as CacheType } from '../Bot/Client.js';
import type BotMetricsType from '../Bot/Metrics.js';

import manager from './Manager.js';
import Metrics from './Metrics.js';

const getCounts = () =>
 manager
  .broadcastEval(() =>
   // @ts-expect-error custom path cuz broadcastEval
   import('/app/Ayako/packages/Gateway/dist/BaseClient/Bot/Client.js').then(
    ({ cache }: { cache: typeof CacheType }) => ({
     guilds: cache.guilds,
     members: Array.from(cache.members.values()).reduce((a, b) => a + b, 0),
     emojis: Array.from(cache.emojis.values()).reduce((a, b) => a + b, 0),
     roles: Array.from(cache.roles.values()).reduce((a, b) => a + b, 0),
     stickers: Array.from(cache.stickers.values()).reduce((a, b) => a + b, 0),
     sounds: Array.from(cache.sounds.values()).reduce((a, b) => a + b, 0),
    }),
   ),
  )
  .then((counts) => ({
   guilds: counts.reduce((a, b) => a + b.guilds, 0),
   members: counts.reduce((a, b) => a + b.members, 0),
   emojis: counts.reduce((a, b) => a + b.emojis, 0),
   roles: counts.reduce((a, b) => a + b.roles, 0),
   stickers: counts.reduce((a, b) => a + b.stickers, 0),
   sounds: counts.reduce((a, b) => a + b.sounds, 0),
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

   const { default: BotMetrics }: { default: typeof BotMetricsType } = await import(
    // @ts-expect-error custom path cuz broadcastEval
    '/app/Ayako/packages/Gateway/dist/BaseClient/Bot/Metrics.js'
   );

   BotMetrics.userInstallCount(app?.approximate_user_install_count ?? 0);
   BotMetrics.userAuthCount(app?.approximate_user_authorization_count ?? 0);

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

  Metrics.guildCount(counts.guilds);
  Metrics.userCount(counts.members);
  Metrics.emojiCount(counts.emojis);
  Metrics.roleCount(counts.roles);
  Metrics.stickerCount(counts.stickers);
  Metrics.clusterCount(getInfo().CLUSTER_COUNT);
  Metrics.shardCount(getInfo().SHARD_LIST.length);

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
