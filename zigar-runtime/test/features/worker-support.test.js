import { expect } from 'chai';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { defineEnvironment } from '../../src/environment.js';
import { capture, delay } from '../test-utils.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Feature: worker-support', function() {
    describe('spawnThread', function() {
      it('should spawn a thread', async function() {
        const env = new Env();
        const url = new URL('./wasm-samples/thread.wasm', import.meta.url);
        const buffer = await readFile(fileURLToPath(url));
        await env.loadModule(buffer, {
          memoryInitial: 256,
          memoryMax: 1024,
          tableInitial: 17,
          multithreaded: true,
        });
        env.acquireStructures({});
        const { spawn } = env.useStructures();
        const [ line ] = await capture(async () => {
          const result = spawn();
          expect(result).to.equal(123);
          await delay(500);
        });
        expect(line).to.equal('Hello!');
      })
    })
  })
}
