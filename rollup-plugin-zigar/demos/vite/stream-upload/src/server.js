import CORS from '@fastify/cors';
import Fastify from 'fastify';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const srcDir = dirname(fileURLToPath(import.meta.url));
const fastify = Fastify({
  http2: true,
  https: {
    key: await readFile(resolve(srcDir, '../key.pem')),
    cert: await readFile(resolve(srcDir, '../cert.pem')),
  },
});
fastify.register(CORS, { methods: [ 'GET', 'PUT' ] });
fastify.get('/', async () => 'Hello world');
fastify.put('/uploads/:filename', async (request) => {
  const uploadDir = resolve(srcDir, '../uploads');
  await mkdir(uploadDir, { recursive: true });
  const filePath = join(uploadDir, request.params.filename);
  const fileStream = createWriteStream(filePath);  
  await pipeline(request.raw.stream, fileStream);
  await fileStream.close();
  return `Received ${fileStream.bytesWritten} bytes`;
});
fastify.listen({ port: 8080 });
