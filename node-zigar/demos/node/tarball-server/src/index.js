import Fastify from 'fastify';
import { dirname, resolve } from 'node:path';
import { duplexPair, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { shutdown, startup, tar } from '../zig/tar.zig';

const srcDir = dirname(fileURLToPath(import.meta.url));
const fastify = Fastify({});
fastify.get('/', async (request, reply) => {
  const tarballSrcDir = resolve(srcDir, '../node_modules');
  const [ sideA, sideB ] = duplexPair(); 
  const streamB = Writable.toWeb(sideB);
  const writer = streamB.getWriter();
  tar(writer, 'modules', [ tarballSrcDir ]).then(() => writer.close());
  reply.header('Content-Disposition', 'attachment; filename=modules.tar.gz');
  return sideA;
});
startup(50);
fastify.addHook('onClose', async () => await shutdown());
fastify.listen({ port: 8080 });
