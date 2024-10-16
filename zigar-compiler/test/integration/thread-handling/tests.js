import { expect } from 'chai';
import 'mocha-skip-if';
import { delay } from '../test-utils.js';

export function addTests(importModule, options) {
  const { target, optimize } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  const importTest = async (name, options) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url, options);
  };
  describe('Thread handling', function() {
    it('should spawn threads and invoke callback', async function() {
      this.timeout(300000);
      const { spawn, shutdown } = await importTest('create-thread-call-function', { multithreaded: true });
      try {
        let count = 0;
        for (let i = 0; i < 10; i++) {
          spawn(() => {
            count++
          });
        }
        await delay(200);
        expect(count).to.equal(10);
      } finally {
        shutdown();
      }
    })
    it('should create thread pool and invoke callback', async function() {
      this.timeout(300000);
      const { start, spawn, shutdown } = await importTest('create-thread-pool', { multithreaded: true });
      start(4);
      try {
        let count = 0;
        for (let i = 0; i < 10; i++) {
          spawn(() => {
            count++
          });
        }
        await delay(200);
        expect(count).to.equal(10);
      } finally {
        shutdown();
      }
    })
  })
}

