import Fastify from 'fastify';
import { availableParallelism } from 'os';
import Sharp from 'sharp';
import { fileURLToPath } from 'url';

const fastify = Fastify();

fastify.get('/', (req, reply) => {
  const name = 'sample';
  const filter = 'sepia';
  const tags = [
    { width: 150, height: 100, intensity: 0.0 },
    { width: 150, height: 100, intensity: 0.3 },
    { width: 300, height: 300, intensity: 0.2 },
    { width: 300, height: 300, intensity: 0.4 },
    { width: 400, height: 400, intensity: 0.3 },
    { width: 500, height: 200, intensity: 0.5 },
  ].map((params) => {
    const json = JSON.stringify(params);
    const base64 = Buffer.from(json).toString('base64');
    const url = `img/${name}/${filter}/${base64}`;
    return `<p><img src="${url}"></p>`;
  });
  reply.type('text/html');
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Image filter test</title>
  </head>
  <body>${tags.join('')}</body>
</html>`;
});
let deinitThreadPool;
fastify.get('/img/:name/:filter/:base64', async (req, reply) => {
  const { name, filter, base64 } = req.params;
  const json = Buffer.from(base64, 'base64');
  const params = JSON.parse(json);
  const url = new URL(`../img/${name}.png`, import.meta.url);
  const path = fileURLToPath(url);
  const { width, height, ...filterParams } = params;
  // open image, resize it, and get raw data
  const inputImage = Sharp(path).ensureAlpha().resize(width, height);
  const { data, info } = await inputImage.raw().toBuffer({ resolveWithObject: true });
  // push data through filter
  const { createOutputAsync, startThreadPool, stopThreadPool } = await import(`../lib/${filter}.zigar`);
  if (!deinitThreadPool) {
    startThreadPool(availableParallelism());
    deinitThreadPool = () => stopThreadPool();
  }
  const input = {
    src: {
      data,
      width: info.width,
      height: info.height,
    }
  };
  const output = await createOutputAsync(info.width, info.height, input, filterParams);
  const { dst } = output;
  // place raw data into new image and output it as JPEG
  const outputImage = Sharp(dst.data.typedArray, { raw: info });
  reply.type('image/jpeg');
  return outputImage.jpeg().toBuffer();
});
fastify.addHook('onClose', () => deinitThreadPool?.());
const address = await fastify.listen({ port: 3000 });
console.log(`Listening at ${address}`);
