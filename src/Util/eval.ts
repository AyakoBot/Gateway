import util from 'util';

import type { APIMessage } from 'discord-api-types/v10';

import { api } from '../BaseClient/Bot/Client.js';

import txtFileWriter from './txtFileWriter.js';

const reg = new RegExp(
 (process.argv.includes('--dev') ? process.env.DevToken : process.env.Token) ?? '',
 'g',
);

const { log } = console;

export default async (msg: APIMessage) => {
 if (msg.author.id !== process.env.ownerId) return;
 if (!msg.content.startsWith('gweval')) return;

 const args = msg.content.split(/\s+/g);
 args.shift();
 const code = `${args.slice(0).join(' ')}`;

 try {
  let evaled = code.includes('await') ? await eval(`(async () => {${code}})()`) : eval(code);
  if (typeof evaled !== 'string') evaled = util.inspect(evaled);

  if (evaled.length > 2000) {
   api.channels.createMessage(msg.channel_id, { files: [txtFileWriter(clean(evaled))] });
   log(clean(evaled));
   return;
  }
  if (clean(evaled) !== '"undefined"') {
   api.channels.createMessage(msg.channel_id, {
    content: `\n${makeCodeBlock(`js\n${clean(evaled)}`)}`,
   });
   log(clean(evaled));
   return;
  }

  api.channels.addMessageReaction(msg.channel_id, msg.id, '❗️');
 } catch (err) {
  if (clean(err).length > 2000) {
   api.channels.createMessage(msg.channel_id, { files: [txtFileWriter(clean(err))] });
   log(clean(err));
   return;
  }

  if (clean(err) !== '"undefined"') {
   api.channels.createMessage(msg.channel_id, {
    content: `\`ERROR\` \n${makeCodeBlock(`js\n${clean((err as Error).message)}`)}\n`,
   });
   log(clean(err));
   return;
  }

  api.channels.addMessageReaction(msg.channel_id, msg.id, '❗️');
 }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clean = (text: unknown): any =>
 JSON.parse(
  JSON.stringify(text, null, 2)
   .replace(/`/g, `\`${String.fromCharCode(8203)}`)
   .replace(/@/g, `@${String.fromCharCode(8203)}`)
   .replace(reg, 'TOKEN'),
 );

const makeCodeBlock = (text: string): string => `\`\`\`${text}\n\`\`\``;
