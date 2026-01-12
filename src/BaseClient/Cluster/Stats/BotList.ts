import manager from '../Manager.js';

const api = 'https://api.botlist.me/api/v1/bots/650691698409734151/stats';

export default (guilds: number) =>
 fetch(api, {
  method: 'post',
  headers: {
   // eslint-disable-next-line @typescript-eslint/naming-convention
   Authorization: process.env.botListToken ?? '',
   'Content-Type': 'application/json',
  },
  body: JSON.stringify({
   server_count: guilds,
   shard_count: manager.totalShards,
  }),
 })
  // eslint-disable-next-line no-console
  .then(async (r) => (r.ok ? undefined : console.log(await r.text())))
  // eslint-disable-next-line no-console
  .catch(() => console.log('Failed to post stats to Top.gg'));
