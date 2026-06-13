import type { Client } from '@discordjs/core';
import { glob } from 'glob';
import { scheduleJob } from 'node-schedule';

import type { cache as CacheType } from '../Bot/Client.js';
import type BotMetricsType from '../Bot/Metrics.js';

import type descriptionsType from './Descriptions.js';
import managers from './Manager.js';
import Metrics from './Metrics.js';

const getCounts = () =>
 Promise.all(
  managers.map(({ key, manager }) =>
   manager
    .broadcastEval(() =>
     // @ts-expect-error custom path cuz broadcastEval
     import('/app/Ayako/packages/Gateway/dist/BaseClient/Bot/Client.js').then(
      ({ cache }: { cache: typeof CacheType }) => ({
       guilds: cache.approxGuilds,
       members: Array.from(cache.members.values()).reduce((a, b) => a + b, 0),
       emojis: Array.from(cache.emojis.values()).reduce((a, b) => a + b, 0),
       roles: Array.from(cache.roles.values()).reduce((a, b) => a + b, 0),
       stickers: Array.from(cache.stickers.values()).reduce((a, b) => a + b, 0),
       sounds: Array.from(cache.sounds.values()).reduce((a, b) => a + b, 0),
      }),
     ),
    )
    .then((counts) => ({
     key,
     guilds: counts.reduce((a, b) => a + b.guilds, 0),
     members: counts.reduce((a, b) => a + b.members, 0),
     emojis: counts.reduce((a, b) => a + b.emojis, 0),
     roles: counts.reduce((a, b) => a + b.roles, 0),
     stickers: counts.reduce((a, b) => a + b.stickers, 0),
     sounds: counts.reduce((a, b) => a + b.sounds, 0),
    })),
  ),
 );

scheduleJob('0 */10 * * * *', async () => {
 const allCounts = await getCounts();

 managers.forEach(({ key, manager }) => {
  const counts = allCounts.find((c) => c.key === key);
  if (!counts) return;

  manager.broadcastEval(
   async (
    clientArg: unknown,
    { guilds, members, key }: { guilds: number; members: number; key: string },
   ) => {
    const cl = clientArg as Client;
    const app = await cl.api.applications
     .getCurrent(undefined)
     .then((res) => ('message' in res ? undefined : res));

    const { default: descriptions }: { default: typeof descriptionsType } = await import(
     // @ts-expect-error custom path cuz broadcastEval
     '/app/Ayako/packages/Gateway/dist/BaseClient/Cluster/Descriptions.js'
    );

    const { default: metrics }: { default: typeof BotMetricsType } = await import(
     // @ts-expect-error custom path cuz broadcastEval
     '/app/Ayako/packages/Gateway/dist/BaseClient/Bot/Metrics.js'
    );

    metrics.userInstallCount(app?.approximate_user_install_count ?? 0);
    metrics.userAuthCount(app?.approximate_user_authorization_count ?? 0);

    cl.api.applications?.editCurrent({
     description:
      descriptions(guilds, members, app)[key as keyof ReturnType<typeof descriptions>] ||
      descriptions(guilds, members, app).MAIN_TOKEN,
    });
   },
   { context: { ...counts, key }, cluster: 0 },
  );
 });
});

const run = () => {
 scheduleJob('0 0 */1 * * *', async () => {
  const allCounts = await getCounts();

  managers.forEach(async ({ key, manager }) => {
   const counts = allCounts.find((c) => c.key === key);
   if (!counts) return;

   Metrics.guildCount(key, counts.guilds);
   Metrics.userCount(key, counts.members);
   Metrics.emojiCount(key, counts.emojis);
   Metrics.roleCount(key, counts.roles);
   Metrics.stickerCount(key, counts.stickers);

   (
    await glob(
     `${process.cwd()}${
      process.cwd().includes('dist') ? '' : '/dist'
     }/BaseClient/Cluster/Stats/**/*`,
    )
   )
    .filter((fileName) => fileName.endsWith('.js'))
    .forEach(async (fileName) => {
     // eslint-disable-next-line no-console
     console.log('Running stats', fileName);

     const file = await import(fileName);

     file.default({
      guilds: counts.guilds,
      members: counts.members,
      shardCount: manager.totalShards,
      shardList: manager.shardList,
     });
    });
  });
 });
};

run();
