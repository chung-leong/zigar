import { expect } from 'chai';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { defineClass } from '../../src/environment.js';
import WorkerSupport from '../../src/features/worker-support.js';
import * as Mixins from '../../src/mixins.js';
import { capture, delay } from '../test-utils.js';

if (process.env.TARGET === 'wasm') {
  describe('Feature: worker-support', function() {
    describe('spawnThread', function() {
      it('should spawn a thread', async function() {
        const mixins = [ ...Object.values(Mixins), WorkerSupport ];
        const Env = defineClass('Environment', mixins);
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
