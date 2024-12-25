import { readFile } from 'fs/promises';
import { JSResponse, setResponder, startServer } from '../zig/server.zig';

setResponder(async ({ allocator }) => {
  const text = await readFile(new URL('test.html', import.meta.url), 'utf-8');
  return new JSResponse({
    mime: 'text/html',
    data: text.replace(/{{TIME}}/, new Date()),
  }, { allocator });
});
startServer('127.0.0.1', 8080);
