const dbl = 'https://discordbotlist.com/api/v1/bots/650691698409734151/stats';

export default (guilds: number, users: number) =>
 fetch(dbl, {
  method: 'post',
  body: JSON.stringify({
   users,
   guilds,
  }),
  headers: {
   'Content-Type': 'application/json',
   // eslint-disable-next-line @typescript-eslint/naming-convention
   Authorization: process.env.DBListToken ?? '',
  },

 })
  // eslint-disable-next-line no-console
  .then(async (r) => (r.ok ? undefined : console.log(await r.text())))
  // eslint-disable-next-line no-console
  .catch(() => console.log('Failed to post stats to Top.gg'));
