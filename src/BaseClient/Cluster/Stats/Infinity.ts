const infinityBots = 'https://spider.infinitybots.gg/bots/stats';

export default ({
 guilds,
 users,
 shardCount,
 shardList,
}: {
 guilds: number;
 users: number;
 shardCount: number;
 shardList: number[];
}) =>
 fetch(infinityBots, {
  method: 'post',
  headers: {
   // eslint-disable-next-line @typescript-eslint/naming-convention
   Authorization: process.env.infinityBots ? `Bot ${process.env.infinityBots}` : '',
   'Content-Type': 'application/json',
  },
  body: JSON.stringify({
   servers: guilds,
   shards: shardCount,
   shard_list: shardList,
   users,
  }),
 })
  // eslint-disable-next-line no-console
  .then(async (r) => (r.ok ? undefined : console.log(await r.text())))
  // eslint-disable-next-line no-console
  .catch(() => console.log('Failed to post stats to Infinity Bots'));
