import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { unlink } from 'fs/promises';
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
    this.timeout(0);
    it('should spawn threads and invoke callback', async function() {
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
      const {
        getCount,
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
        for (let i = 0; i < 20; i++) {
          if (getCount() == 10) break;
          await delay(25);
        }
        expect(count).to.equal(10);
      } finally {
        shutdown();
      }
    })
    it('should create thread that resolves a promise', async function() {
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
    it('should receive plain object from promise', async function() {
      const {
        startup,
        spawn,
        shutdown,
      } = await importTest('create-thread-with-plain-object-promise', { multithreaded: true });
      startup();
      try {
        const promise = spawn();
        expect(promise).to.be.a('promise');
        const result = await promise;
        expect(result).to.eql({ x: 123n, y: 456n });
      } finally {
        shutdown();
      }
    })
    it('should receive strings from generator', async function() {
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
    it('should receive strings from allocating generator', async function() {
      const {
        startup,
        spawn,
        shutdown,
      } = await importTest('create-thread-with-allocating-generator', { multithreaded: true });
      startup();
      try {
        const generator = spawn();
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
    it('should receive plain objects from generator', async function() {
      const {
        startup,
        spawn,
        shutdown,
      } = await importTest('create-thread-with-plain-object-generator', { multithreaded: true });
      startup();
      try {
        const generator = spawn();
        expect(generator[Symbol.asyncIterator]).to.be.a('function');
        const list = [];
        for await (const s of generator) {
          list.push(s);
        }
        expect(list).to.have.lengthOf(5);
        expect(list).to.eql([
          { x: 0n, y: 0n },
          { x: 10n, y: 100n },
          { x: 20n, y: 200n },
          { x: 30n, y: 300n },
          { x: 40n, y: 400n }
        ]);
      } finally {
        shutdown();
      }
    })
    it('should create thread or immediately provide a value', async function() {
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
      const {
        spawn,
      } = await importTest('create-thread-promise-failure', { multithreaded: true });
      const promise = spawn();
      await expect(promise).to.eventually.be.rejectedWith(Error).with.property('message', 'Thread creation failure');
    })
    it('should create thread that accepts an abort signal', async function() {
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
    it('should call functions through work queue', async function() {
      const {
        startup,
        shutdown,
        returnString,
        returnInt,
        returnPoint
      } = await importTest('use-work-queue', { multithreaded: true });
      startup(2);
      try {
        const str = await returnString();
        expect(str).to.equal('Hello world!');
        const int = await returnInt();
        expect(int).to.equal(1234);
        const point = await returnPoint();
        expect(point).to.eql({ x: 0.1234, y: 0.4567 });
      } finally {
        await shutdown();
      }
    })
    it('should call functions through single-thread work queue', async function() {
      const {
        startup,
        shutdown,
        returnString,
        returnInt,
        returnPoint
      } = await importTest('use-work-queue-single-thread', { multithreaded: true });
      startup();
      try {
        const str = await returnString();
        expect(str).to.equal('Hello world!');
        const int = await returnInt();
        expect(int).to.equal(1234);
        const point = await returnPoint();
        expect(point).to.eql({ x: 0.1234, y: 0.4567 });
      } finally {
        await shutdown();
      }
    })
    it('should call invoke thread start function', async function() {
      const {
        startup,
        shutdown,
        returnString,
        returnInt,
        returnPoint
      } = await importTest('use-work-queue-with-thread-start-fn', { multithreaded: true });
      startup();
      try {
        const str = await returnString();
        expect(str).to.equal('Hello world!');
        const int = await returnInt();
        expect(int).to.equal(1234);
        const point = await returnPoint();
        expect(point).to.eql({ x: 0.1234, y: 0.4567 });
      } finally {
        await shutdown();
      }
    })
    it('should initialize work queue automatically', async function() {
      const {
        shutdown,
        returnString,
        returnInt,
        returnPoint
      } = await importTest('use-work-queue-auto-init', { multithreaded: true });
      try {
        const str = await returnString();
        expect(str).to.equal('Hello world!');
        const int = await returnInt();
        expect(int).to.equal(1234);
        const point = await returnPoint();
        expect(point).to.eql({ x: 0.1234, y: 0.4567 });
      } finally {
        await shutdown();
      }
    })
    it('should not compile when a function accepts an AbortSignal without Promise', async function() {
      const promise = importTest('abort-signal-without-promise');
      expect(promise).to.be.eventually.be.rejectedWith(Error)
        .with.property('message').that.contains('AbortSignal');
    })
    it('should create a detached thread using pthread', async function() {
      const { 
        spawn,
        startup,
        shutdown,
      } = await importTest('create-detached-thread-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(250);
        });
        expect(lines).to.eql([ 'Hello world!' ]);
      } finally {
        shutdown();
      }
    })
    it('should create a thread in a thread using pthread', async function() {
      const { 
        spawn,
        startup,
        shutdown,
      } = await importTest('create-thread-in-thread-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(250);
        });
        expect(lines).to.eql([ 
          'Hello world!',
          'retval = 1234',
        ]);
      } finally {
        shutdown();
      }
    })
    it('should exit thread created using pthread', async function() {
      const { 
        spawn,
        startup,
        shutdown,
      } = await importTest('exit-thread-created-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(250);
        });
        expect(lines).to.eql([ 
          'Hello world! 0',
          'Hello world! 1',
          'Hello world! 2',
          'Hello world! 3',
        ]);
      } finally {
        shutdown();
      }
    })
    it('should exit thread created in a thread using pthread', async function() {
      const { 
        spawn,
        startup,
        shutdown,
      } = await importTest('exit-thread-created-in-thread-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(250);
        });
        expect(lines).to.eql([ 
          'Hello world! 0',
          'Hello world! 1',
          'Hello world! 2',
          'Hello world! 3',
          'retval = 1234',
        ]);
      } finally {
        shutdown();
      }
    })
    it('should print ids of threads created using pthread', async function() {
      const { 
        spawn,
        startup,
        shutdown,
      } = await importTest('print-ids-of-threads-created-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn(5);
          await delay(500);
        });
        expect(lines).to.have.lengthOf(5);
        for (const line of lines) {
          expect(line).to.match(/^thread_id =/);
        }
      } finally {
        shutdown();
      }
    })
    it('should create mutex using pthread', async function() {
      const { 
        spawn,
        startup,
        shutdown,
      } = await importTest('create-mutex-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(500);
        });
        expect(lines).to.eql([
          'Thread 1 acquired mutex',
          'Thread 2 acquired mutex',
        ]);
      } finally {
        shutdown();
      }
    })
    it('should create error-checking mutex using pthread', async function() {
      const { 
        spawn,
        startup,
        shutdown,
      } = await importTest('create-error-checking-mutex-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(500);
        });
        expect(lines).to.eql([ 'retval == EDEADLK: true' ]);
      } finally {
        shutdown();
      }
    })
    it('should create recursive mutex using pthread', async function() {
      const { 
        spawn,
        startup,
        shutdown,
      } = await importTest('create-recursive-mutex-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(500);
        });
        expect(lines).to.eql([
          'Thread 1 acquired mutex',
          'Thread 2 acquired mutex',
        ]);
      } finally {
        shutdown();
      }
    })
    it('should wait momentarily for mutex created using pthread', async function() {
      const { 
        spawn,
        startup,
        shutdown,
      } = await importTest('wait-momentarily-for-mutex-created-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(500);
        });
        expect(lines).to.eql([
          'Thread 1 acquired mutex',
          'Thread 3 timed out: true',
          'Thread 2 acquired mutex',
        ]);
      } finally {
        shutdown();
      }
    })
    it('should create spinlock using pthread', async function() {
      const { 
        spawn,
        unlock,
        startup,
        shutdown,
      } = await importTest('create-spinlock-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(250);
          unlock();
          await delay(500);
        });
        expect(lines).to.eql([
          'Main thread acquired spinlock',
          'Thread 2 found busy lock: true',
          'Main thread released spinlock',
          'Thread 1 acquired spinlock'
        ]);
      } finally {
        shutdown();
      }
    })
    it('should create read/write lock using pthread', async function() {
      const { 
        spawn,
        unlock,
        cleanup,
        startup,
        shutdown,
      } = await importTest('create-rwlock-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        for (const write of [ false, true ]) {
          const lines = await capture(async () => {
            spawn(write);
            await delay(250);
            unlock();
            await delay(250);
            cleanup();
          });
          const type = (write) ? 'write' : 'read';
          expect(lines[0]).to.equal(`Main thread acquired ${type} lock`);
          const mtReleased = lines.indexOf(`Main thread released ${type} lock`);
          const t1Acquired = lines.indexOf(`Thread 1 acquired read lock`);
          const t2Acquired = lines.indexOf(`Thread 2 acquired write lock`);
          if (write) {
            expect(mtReleased < t1Acquired).to.be.true;
            expect(mtReleased < t2Acquired).to.be.true;
          } else {
            // Zig's implementation of the read/lock lock prevents an acquisition of a read lock
            // if another thread has made an earlier request for a write lock
            if (t1Acquired < t2Acquired) {
              expect(mtReleased > t1Acquired).to.be.true; 
            } else {
              expect(mtReleased < t1Acquired).to.be.true; 
            }
          }
          expect(mtReleased < t2Acquired).to.be.true;
        }
      } finally {
        shutdown();
      }
    })
    it('should wait momentarily for read lock created using pthread', async function() {
      const { 
        spawn,
        unlock,
        startup,
        shutdown,
      } = await importTest('wait-momentarily-for-read-lock-created-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(250);
          unlock();
          await delay(550);
        });
        expect(lines).to.eql([
          'Main thread acquired write lock',
          'Thread 1 acquiring read lock',
          'Thread 2 acquiring read lock',
          'Thread 1 timed out: true',
          'Main thread releasing write lock',
          'Thread 2 acquired read lock'
        ]);
      } finally {
        shutdown();
      }
    })
    it('should wait momentarily for write lock created using pthread', async function() {
      const { 
        spawn,
        unlock,
        startup,
        shutdown,
      } = await importTest('wait-momentarily-for-write-lock-created-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(250);
          unlock();
          await delay(550);
        });
        expect(lines).to.eql([
          'Main thread acquired write lock',
          'Thread 1 acquiring write lock',
          'Thread 2 acquiring write lock',
          'Thread 1 timed out: true',
          'Main thread releasing write lock',
          'Thread 2 acquired write lock'
        ]);
      } finally {
        shutdown();
      }
    })
    it('should create semaphore using pthread', async function() {
      const { 
        spawn,
        startup,
        shutdown,
      } = await importTest('create-semaphore-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(500);
        });
        const list0 = lines.filter(l => l.includes('acquired semaphore: 0'));
        const list1 = lines.filter(l => l.includes('acquired semaphore: 1'));
        expect(list0).to.have.lengthOf(2);
        expect(list1).to.have.lengthOf(1);
      } finally {
        shutdown();
      }
    })
    it('should create named semaphore using pthread', async function() {
      const { 
        spawn,
        cleanup,
        startup,
        shutdown,
      } = await importTest('create-named-semaphore-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });            
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(500);
        });
        cleanup();
        const list0 = lines.filter(l => l.includes('acquired semaphore: 0'));
        const list1 = lines.filter(l => l.includes('acquired semaphore: 1'));
        expect(list0).to.have.lengthOf(2);
        expect(list1).to.have.lengthOf(1);
      } finally {
        shutdown();
        try {
          await unlink('/dev/shm/sem.hello');
        } catch {}
      }
    })
    it('should wait momentarily for semaphore created using pthread', async function() {
      const { 
        spawn,
        startup,
        shutdown,
      } = await importTest('wait-momentarily-for-semaphore-created-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(500);
        });
        const list0 = lines.filter(l => l.includes('acquired semaphore: 0'));
        const list1 = lines.filter(l => l.includes('acquired semaphore: 1'));
        const listTO = lines.filter(l => l.includes('timed out'));
        expect(list0).to.have.lengthOf(1);
        expect(list1).to.have.lengthOf(1);
        expect(listTO).to.have.lengthOf(1);
      } finally {
        shutdown();
      }
    })
    it('should try to get semaphore created using pthread', async function() {
      const { 
        spawn,
        startup,
        shutdown,
      } = await importTest('get-semaphore-created-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(500);
        });
        const list0 = lines.filter(l => l.includes('acquired semaphore: 0'));
        const list1 = lines.filter(l => l.includes('acquired semaphore: 1'));
        const listTO = lines.filter(l => l.includes('failed'));
        expect(list0).to.have.lengthOf(1);
        expect(list1).to.have.lengthOf(1);
        expect(listTO).to.have.lengthOf(1);
      } finally {
        shutdown();
      }
    })
    it('should create key for thread specific values using pthread', async function() {
      const { 
        spawn,
        startup,
        shutdown,
      } = await importTest('create-key-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(500);
        });
        const expected = [
          'Thread 1 found anyopaque@12345 and anyopaque@67',
          'Thread 2 found anyopaque@22222 and null',
          'Destructor 1 called: anyopaque@12345',
          'Destructor 2 called: anyopaque@67',
          'Destructor 1 called: anyopaque@22222'
        ];
        for (const line of expected) {
          expect(lines).to.contain(line);
        }
      } finally {
        shutdown();
      }
    })
    it('should exit thread not created using pthread', async function() {
      const { 
        spawn,
        startup,
        shutdown,
      } = await importTest('exit-thread-not-created-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(500);
        });
        expect(lines).to.eql([ 'Destructor called: anyopaque@12345' ]);
      } finally {
        shutdown();
      }
    })
    it('should call function once using pthread', async function() {
      const { 
        spawn,
        startup,
        shutdown,
      } = await importTest('call-function-once-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(500);
        });
        expect(lines).to.eql([ 'Once upon a time...' ]);
      } finally {
        shutdown();
      }
    })
    it('should create condition using pthread', async function() {
      const { 
        spawn,
        signal,
        broadcast,
        startup,
        shutdown,
      } = await importTest('create-condition-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines1 = await capture(async () => {
          spawn();
          await delay(300);
          signal();
          await delay(200);
        });
        expect(lines1).to.eql([
          'Thread waiting for condition',
          'Thread waiting for condition',
          'Thread waiting for condition',
          'Thread saw condition',
        ]);
        const lines2 = await capture(async () => {
          broadcast();
          await delay(200);
        });
        expect(lines2).to.eql([
          'Thread saw condition',
          'Thread saw condition',
        ]);
      } finally {
        shutdown();
      }
    })
    it('should wait momentarily for condition created using pthread', async function() {
      const { 
        spawn,
        signal,
        startup,
        shutdown,
      } = await importTest('wait-momentarily-for-condition-created-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(250);
          signal();
          await delay(400);
        });
        const listS = lines.filter(l => l.includes('saw'));
        const listTO = lines.filter(l => l.includes('timed out'));
        expect(listS).to.have.lengthOf(1);
        expect(listTO).to.have.lengthOf(2);
     } finally {
        shutdown();
      }
    })
    skip.unless(target === 'wasm32').
    it('should perform deferred cancellation on thread mechanism thread using pthread', async function() {
      const { 
        spawn,
        cancel,
        startup,
        shutdown,
      } = await importTest('perform-deferred-cancellation-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(250);
          cancel();
          await delay(400);
        });
        expect(lines).to.eql([ 
          'Clean-up function called: 12345', 
          'Destructor called: Hello world' 
        ]);
     } finally {
        shutdown();
      }
    })
    skip.unless(target === 'wasm32').
    it('should perform asynchronous cancellation on thread using pthread', async function() {
      const { 
        spawn,
        cancel,
        getCount,
        startup,
        shutdown,
      } = await importTest('perform-async-cancellation-with-pthread', { multithreaded: true, useLibc: true, usePthreadEmulation: true });
      startup();
      try {
        const lines = await capture(async () => {
          spawn();
          await delay(250);
          cancel();
          await delay(500);
        });
        expect(lines).to.eql([
          'Original cancellation type: 0',
          'Clean-up function called: 12345', 
          'Destructor called: Hello world' 
        ]);
        // double-check that the thread has stopped
        const count1 = getCount();
        await delay(50);
        const count2 = getCount();
        expect(count1).to.equal(count2);
     } finally {
        shutdown();
      }
    })

  })
}

