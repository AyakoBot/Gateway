import Manager from '../Manager.js';

const APIInfinityBots = 'https://spider.infinitybots.gg/bots/stats';

export default (guilds: number, users: number) =>
 fetch(APIInfinityBots, {
  method: 'post',
  headers: {
   // eslint-disable-next-line @typescript-eslint/naming-convention
   Authorization: process.env.infinityBots ? `Bot ${process.env.infinityBots}` : '',
   'Content-Type': 'application/json',
  },
  body: JSON.stringify({
   servers: guilds,
   shards: Manager.totalShards,
   shard_list: Manager.shardList,
   users,
  }),
  // eslint-disable-next-line no-console
 })
  // eslint-disable-next-line no-console
  .then(async (r) => (r.ok ? undefined : console.log(await r.text())))
  // eslint-disable-next-line no-console
  .catch(() => console.log('Failed to post stats to Top.gg'));
