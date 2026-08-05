import Fastify from 'fastify';
import Sharp from 'sharp';
import { fileURLToPath } from 'url';
import { scale } from './scale.js';
import { apply } from './sepia.js';

const fastify = Fastify();

fastify.get('/scale/:width/:height', async (req, reply) => {
    reply.type('image/jpeg');
    const url = new URL(`./sample.png`, import.meta.url);
    const path = fileURLToPath(url);
    // open image and get raw data
    const buffer = await Sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const inputImage = {
      data: buffer.data,
      width: buffer.info.width,
      height: buffer.info.height,
    };
    // allocate memory for output image
    const width = parseInt(req.params.width);
    const height = parseInt(req.params.height);
    const size = width * height * 4;
    const data = new Uint8Array(size);
    const outputImage = { data, width, height };
    // pass input and output image to Zig function
    scale(inputImage, outputImage);
    const info = { ...buffer.info, width, height, size };
    // compress output as JPEG and return buffer to Fastify
    return await Sharp(data, { raw: info }).jpeg().toBuffer();
});
fastify.get('/sepia/:intensity', async (req, reply) => {
    reply.type('image/jpeg');
    const url = new URL(`./sample.png`, import.meta.url);
    const path = fileURLToPath(url);
    const buffer = await Sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const inputImage = {
      data: buffer.data,
      width: buffer.info.width,
      height: buffer.info.height,
    };
    const { width, height, size } = buffer.info;
    const data = new Uint8Array(size);
    const outputImage = { data, width, height };
    const intensity = parseFloat(req.params.intensity);
    apply(inputImage, outputImage, intensity);
    const info = { ...buffer.info, width, height, size };
    return await Sharp(data, { raw: info }).jpeg().toBuffer();
});
const address = await fastify.listen({ host: 'localhost', port: 8080 });
console.log(`Listening at ${address}`);
