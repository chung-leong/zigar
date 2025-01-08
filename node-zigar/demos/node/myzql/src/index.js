import FormBody from '@fastify/formbody';
import Fastify from 'fastify';
import { PassThrough } from 'stream';
import { closeDatabase, findPersons, insertPerson, openDatabase } from '../lib/mysql.zigar';

const fastify = Fastify();
fastify.register(FormBody);
fastify.get('/', async (req, reply) => {
  const stream = new PassThrough();
  reply.type('html');
  reply.send(stream);
  stream.write(`<!doctype html>`);
  stream.write(`<html lang="en"><head><meta charset="UTF-8" /><title>MyZql test</title></head><body>`);
  stream.write(`<form method="POST"><ul>`);
  for await (const person of findPersons()) {
    stream.write(`<li>${person.name.string} (${person.age})</li>`);
  }
  stream.write(`<li><input name="name"> (<input name="age" size="2">) <button>Add</button></li>`)
  stream.write(`</ul></form>`);
  stream.write(`</body></html>`);
  stream.end();
});
fastify.post('/', async (req, reply) => {
  const id = await insertPerson(req.body);
  console.log({ id });
  reply.redirect('/', 302);
})
fastify.addHook('onClose', () => closeDatabase());

openDatabase({
  host: '172.17.0.2',
  username: 'zig_user',
  password: 'password123',
  database: 'testdb',
  threads: 4,
});
const address = await fastify.listen({ port: 3000 });
console.log(`Listening at ${address}`);
