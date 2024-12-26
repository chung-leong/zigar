import { readFile } from 'fs/promises';
import { setResponder, startServer } from '../zig/server.zig';

const host = '127.0.0.1';
const port = 8080;
startServer(host, port);
console.log(`Listening at http://${host}:${port}`);

setResponder(0, async (uri, { allocator }) => {
  const template = await readFile(new URL('template.html', import.meta.url), 'utf-8');
  const vars = {
    time: new Date(),
    uri: uri.string,
  };
  const text = template.replace(/{{(\w+)}}/g, (m0, m1) => vars[m1]);
  return allocator.dupe(text);
});
