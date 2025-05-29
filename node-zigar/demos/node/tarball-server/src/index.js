import Fastify from 'fastify';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shutdown, startup, tar } from './tar.js';

const srcDir = dirname(fileURLToPath(import.meta.url));
const fastify = Fastify({});
fastify.get('/', async (request, reply) => {
  reply.type('html');
  return `<a href="download">Download</a>`;
});
fastify.get('/download', async (request, reply) => {
  const tarballSrcDir = resolve(srcDir, '../node_modules');
  const transform = new TransformStream(undefined, { highWaterMark: 1024 * 16 });
  const writer = transform.writable.getWriter();
  tar(writer, 'modules', [ tarballSrcDir ]).then(() => writer.close());
  reply.header('Content-Disposition', 'attachment; filename=modules.tar.gz');
  return transform.readable;
});
startup(50);
fastify.addHook('onClose', async () => await shutdown());
fastify.listen({ port: 8080 });
