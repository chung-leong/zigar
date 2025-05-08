import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mocha-skip-if';
import { capture, delay } from '../test-utils.js';

use(chaiAsPromised);

export function addTests(importModule, options) {
  const { target, optimize } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  const importTest = async (name, options) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url, options);
  };
  describe('Thread handling', function() {
    it('should spawn threads and invoke callback', async function() {
      this.timeout(0);
      const {
        spawn,
        startup,
        shutdown,
      } = await importTest('create-thread-call-function', { multithreaded: true });
      startup();
      try {
        let count = 0;
        for (let i = 0; i < 10; i++) {
          spawn(() => {
            count++
          });
        }
        await delay(1000);
        expect(count).to.equal(10);
        const [ line ] = await capture(async () => {
          spawn(() => {
            throw new Error("Doh!");
          });
          await delay(250);
        });
        expect(line).to.equal('Error: Unexpected');
      } finally {
        shutdown();
      }
    })
    it('should create thread pool and invoke callback', async function() {
      this.timeout(0);
      const {
        startup,
        spawn,
        shutdown,
      } = await importTest('create-thread-pool', { multithreaded: true, maxMemory: 1024 * 1024 * 512 });
      startup(4);
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
    it('should create thread that resolves a promise', async function() {
      this.timeout(0);
      const {
        startup,
        spawn,
        shutdown,
      } = await importTest('create-thread-with-promise', { multithreaded: true });
      startup();
      try {
        const promise = spawn();
        expect(promise).to.be.a('promise');
        const result1 = await promise;
        expect(result1).to.equal(1234);
        // use callback instead
        let result2 = -1;
        spawn({
          callback(v) {
            result2 = v;
          }
        });
        await delay(250);
        expect(result2).to.equal(1234);
        // try promise again
        const result3 = await spawn();
        expect(result2).to.equal(1234);
      } finally {
        shutdown();
      }
    })
    it('should receive string from promise', async function() {
      this.timeout(0);
      const {
        startup,
        spawn,
        shutdown,
      } = await importTest('create-thread-with-string-promise', { multithreaded: true });
      startup();
      try {
        const promise = spawn();
        expect(promise).to.be.a('promise');
        const result = await promise;
        expect(result).to.equal('Hello world');
      } finally {
        shutdown();
      }
    })
    it('should receive string from generator', async function() {
      this.timeout(0);
      const {
        startup,
        spawn,
        shutdown,
      } = await importTest('create-thread-with-string-generator', { multithreaded: true });
      startup();
      try {
        const generator = spawn();
        expect(generator[Symbol.asyncIterator]).to.be.a('function');
        const list = [];
        for await (const s of generator) {
          list.push(s);
          expect(s).to.equal('Hello world');
        }
        expect(list).to.have.lengthOf(5);
      } finally {
        shutdown();
      }
    })
    it('should create thread or immediately provide a value', async function() {
      this.timeout(0);
      const {
        startup,
        spawn,
        shutdown,
      } = await importTest('create-thread-optionally', { multithreaded: true });
      startup();
      try {
        await expect(spawn(true)).to.eventually.equal(1234);
        await expect(spawn(false)).to.eventually.equal(777);
        // make sure callback would get called
        let result = -1;
        spawn(false, {
          callback(v) {
            result = v;
          }
        });
        expect(result).to.equal(777);
      } finally {
        shutdown();
      }
    })
    it('should reject a promise synchronously', async function() {
      this.timeout(0);
      const {
        spawn,
      } = await importTest('create-thread-promise-failure', { multithreaded: true });
      const promise = spawn();
      await expect(promise).to.eventually.be.rejectedWith(Error).with.property('message', 'Thread creation failure');
    })
    it('should create thread that accepts an abort signal', async function() {
      this.timeout(0);
      const {
        startup,
        spawn,
        shutdown,
      } = await importTest('create-thread-with-abort-signal', { multithreaded: true });
      startup();
      try {
        const controller1 = new AbortController();
        const promise1 = spawn(true, { signal: controller1.signal });
        setTimeout(() => controller1.abort(), 100);
        let result, error;
        try {
          result = await promise1;
        } catch (err) {
          error = err;
        }
        expect(error).to.be.an('error');
        error = null;
        const controller2 = new AbortController();
        const promise2 = spawn(false, { signal: controller2.signal });
        setTimeout(() => controller2.abort(), 100);
        try {
          result = await promise2;
        } catch (err) {
          error = err;
        }
        expect(result).to.equal(1234);
      } finally {
        shutdown();
      }
    })
    it('should create thread that accepts an abort signal that works atomically', async function() {
      this.timeout(0);
      const {
        startup,
        spawn,
        shutdown,
      } = await importTest('create-thread-with-abort-signal-atomic', { multithreaded: true });
      startup();
      try {
        const controller1 = new AbortController();
        const promise1 = spawn(true, { signal: controller1.signal });
        setTimeout(() => controller1.abort(), 100);
        let result, error;
        try {
          result = await promise1;
        } catch (err) {
          error = err;
        }
        // expect(error).to.be.an('error');
        // error = null;
        // const controller2 = new AbortController();
        // const promise2 = spawn(false, { signal: controller2.signal });
        // setTimeout(() => controller2.abort(), 100);
        // try {
        //   result = await promise2;
        // } catch (err) {
        //   error = err;
        // }
        // expect(result).to.equal(1234);
      } finally {
        shutdown();
      }
    })
    it('should create thread that allocate memory', async function() {
      this.timeout(0);
      const {
        startup,
        spawn,
        shutdown,
      } = await importTest('create-thread-allocate-memory', { multithreaded: true });
      startup();
      try {
        const result = await spawn();
        expect(result.string).to.equal("Hello world");
      } finally {
        shutdown();
      }
    })
    it('should create thread pool for function returning promise', async function() {
      this.timeout(0);
      const {
        startup,
        spawn,
        shutdown,
      } = await importTest('create-thread-pool-return-promise', { multithreaded: true, maxMemory: 1024 * 1024 * 512 });
      startup(4);
      try {
        const result = await spawn();
        expect(result).to.equal(1234);
      } finally {
        shutdown();
      }
    })
    it('should not compile when a function accepts an AbortSignal without Promise', async function() {
      this.timeout(0);
      const promise = importTest('abort-signal-without-promise');
      expect(promise).to.be.eventually.be.rejectedWith(Error)
        .with.property('message').that.contains('AbortSignal');
    })
  })
}

