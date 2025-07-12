import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { open, readFile } from 'fs/promises';
import 'mocha-skip-if';
import { platform } from 'os';
import { fileURLToPath } from 'url';
import { capture, captureError } from '../test-utils.js';

use(chaiAsPromised);

export function addTests(importModule, options) {
  const { target, optimize } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  const importTest = async (name, options) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url, options);
  };
  describe('Stream handling', function() {
    it('should read from reader', async function() {
      this.timeout(0);
      const {
        startup,
        shutdown,
        hash,
      } = await importTest('read-from-reader', { multithreaded: true });
      startup(1);
      try {
        const correct = (platform() === 'win32') 
        ? '8b25078fffd077f119a53a0121a560b3eba816a0' 
        : 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
        const path = absolute('./data/test.txt');
        const fd = await open(path);
        const stream = fd.readableWebStream();
        const digest1 = await hash(stream.getReader());
        expect(digest1.string).to.equal(correct);
        // Uint8Array as input
        const content = await readFile(path);
        const digest2 = await hash(content);
        expect(digest2.string).to.equal(correct);
        // Blob as input
        const blob = new Blob([ content ]);
        const digest3 = await hash(content);
        expect(digest3.string).to.equal(correct);
      } finally {
        await shutdown();
      }
    })
    it('should read from reader in main thread', async function() {
      this.timeout(0);
      const { hash } = await importTest('read-from-reader-in-main-thread');
      const correct = (platform() === 'win32') 
      ? '8b25078fffd077f119a53a0121a560b3eba816a0' 
      : 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
      const path = absolute('./data/test.txt');
      const content = await readFile(path);
      const digest = hash(content);
      expect(digest.string).to.equal(correct);
    })
    it('should read from file', async function() {
      this.timeout(0);
      const {
        startup,
        shutdown,
        hash,
      } = await importTest('read-from-file', { multithreaded: true });
      startup(1);
      try {
        const correct = (platform() === 'win32') 
        ? '8b25078fffd077f119a53a0121a560b3eba816a0' 
        : 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
        const path = absolute('./data/test.txt');
        const fd = await open(path);
        const stream = fd.readableWebStream();
        const reader = stream.getReader();
        const digest1 = await hash(reader);
        expect(digest1.string).to.equal(correct);
        reader.close();
        // Uint8Array as input
        const content = await readFile(path);
        const digest2 = await hash(content);
        expect(digest2.string).to.equal(correct);
        // Blob as input
        const blob = new Blob([ content ]);
        const digest3 = await hash(content);
        expect(digest3.string).to.equal(correct);
      } finally {
        await shutdown();
      }
    })
    it('should read from file in main thread', async function() {
      this.timeout(0);
      const { hash } = await importTest('read-from-file-in-main-thread');
      const correct = (platform() === 'win32') 
      ? '8b25078fffd077f119a53a0121a560b3eba816a0' 
      : 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
      const path = absolute('./data/test.txt');
      const content = await readFile(path);
      const digest = hash(content);
      expect(digest.string).to.equal(correct);
    })
    it('should open and read from file in main thread', async function() {
      this.timeout(0);
      const { __zigar, hash } = await importTest('open-and-read-from-file-in-main-thread');
      const correct = (platform() === 'win32') 
      ? '8b25078fffd077f119a53a0121a560b3eba816a0' 
      : 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
      const path = absolute('./data/test.txt');
      const content = await readFile(path);
      let event;
      __zigar.on('open', (evt) => {
        event = evt;
        return content;
      });
      const digest = hash('/hello/world');
      expect(digest.string).to.equal(correct);
      expect(event).to.eql({ 
        parent: null,
        path: 'hello/world', 
        rights: { read: true }, 
        flags: { symlinkFollow: true }, 
      });
    })
    it('should open and read from file using posix functions', async function() {
      this.timeout(0);
      const { __zigar, hash } = await importTest('open-and-read-file-with-posix-functions');
      const correct = (platform() === 'win32') 
      ? '8b25078fffd077f119a53a0121a560b3eba816a0' 
      : 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
      const path = absolute('./data/test.txt');
      const content = await readFile(path);
      let event;
      __zigar.on('open', (evt) => {
        event = evt;
        return content;
      });
      const digest = hash('/hello/world');
      expect(digest.string).to.equal(correct);
      expect(event).to.eql({ 
        parent: null,
        path: 'hello/world', 
        rights: { read: true }, 
        flags: { symlinkFollow: true }, 
      });
    })
    it('should open and read from file using libc functions', async function() {
      this.timeout(0);
      const { __zigar, hash } = await importTest('open-and-read-file-with-libc-functions');
      const correct = (platform() === 'win32') 
      ? '8b25078fffd077f119a53a0121a560b3eba816a0' 
      : 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
      const path = absolute('./data/test.txt');
      const content = await readFile(path);
      let event;
      __zigar.on('open', (evt) => {
        event = evt;
        return content;
      });
      const digest = hash('/hello/world');
      expect(digest.string).to.equal(correct);
      expect(event).to.eql({ 
        parent: null,
        path: 'hello/world', 
        rights: { read: true }, 
        flags: { symlinkFollow: true }, 
      });
    })
    it('should open a file and seek to a particular position using posix functions', async function() {
      this.timeout(0);
      const { __zigar, read } = await importTest('seek-file-with-posix-functions');
      const path = absolute('./data/test.txt');
      const content = await readFile(path);
      __zigar.on('open', () => content);
      const chunk = read('/hello/world', 32, 16);
      expect(chunk).to.have.lengthOf(16);
      expect(chunk.string).to.equal('ur fathers broug');
    })
    it('should open a file and seek to a particular position using libc functions', async function() {
      this.timeout(0);
      const { __zigar, read } = await importTest('seek-file-with-libc-functions');
      const path = absolute('./data/test.txt');
      const content = await readFile(path);
      __zigar.on('open', () => content);
      const chunk = read('/hello/world', 32, 16);
      expect(chunk).to.have.lengthOf(16);
      expect(chunk.string).to.equal('ur fathers broug');
    })
    it('should obtain the expected position after a seek operation using posix function', async function() {
      this.timeout(0);
      const { __zigar, seek } = await importTest('return-file-position-with-posix-functions');
      const content = new TextEncoder().encode('Hello world!');
      __zigar.on('open', () => content);
      const pos = seek('/hello/world', -2);
      expect(pos).to.equal(BigInt(content.length - 2));
    })
    it('should obtain the expected position after a seek operation using libc function', async function() {
      this.timeout(0);
      const { __zigar, seek } = await importTest('return-file-position-with-libc-functions');
      const content = new TextEncoder().encode('Hello world!');
      __zigar.on('open', () => content);
      const pos = seek('/hello/world', -2);
      expect(pos).to.equal(BigInt(content.length - 2));
    })
    it('should write to writer', async function() {
      this.timeout(0);
      const {
        startup,
        shutdown,
        save,
      } = await importTest('write-to-writer', { multithreaded: true });
      startup(1);
      try {
        const fd = await open(absolute('./data/output.txt'), 'w');
        const stream = new WritableStream({
          write(chunk) {
            fd.write(chunk);
          },
        });
        const len1 = await save('This is a test', stream.getWriter());
        fd.close();
        expect(len1).to.equal(14);
        const chunks = [];
        const len2 = await save('This is a test', chunks);
        expect(len2).to.equal(14);
        expect(chunks).to.have.lengthOf(1);
        const blob = new Blob(chunks);
        const string = await blob.text();
        expect(string).to.equal('This is a test');
      } finally {
        await shutdown();
      }
    })
    it('should write to writer in main thread', async function() {
      this.timeout(0);
      const { save } = await importTest('write-to-writer-in-main-thread');
      const chunks = [];
      const len = save('This is a test', chunks);
      expect(len).to.equal(14);
      expect(chunks).to.have.lengthOf(1);
      const blob = new Blob(chunks);
      const string = await blob.text();
      expect(string).to.equal('This is a test');
    })
    it('should write to file', async function() {
      this.timeout(0);
      const {
        startup,
        shutdown,
        save,
      } = await importTest('write-to-file', { multithreaded: true });
      startup(1);
      try {
        const fd = await open(absolute('./data/output.txt'), 'w');
        const stream = new WritableStream({
          write(chunk) {
            fd.write(chunk);
          },
        });
        const len1 = await save('This is a test', stream.getWriter());
        fd.close();
        expect(len1).to.equal(14);
        const chunks = [];
        const len2 = await save('This is a test', chunks);
        expect(len2).to.equal(14);
        expect(chunks).to.have.lengthOf(1);
        const blob = new Blob(chunks);
        const string = await blob.text();
        expect(string).to.equal('This is a test');
      } finally {
        await shutdown();
      }
    })
    it('should write to file in main thread', async function() {
      this.timeout(0);
      const { save } = await importTest('write-to-file-in-main-thread');
      const chunks = [];
      const len =  save('This is a test', chunks);
      expect(len).to.equal(14);
      expect(chunks).to.have.lengthOf(1);
      const blob = new Blob(chunks);
      const string = await blob.text();
      expect(string).to.equal('This is a test');
    })
    it('should open and write to file in main thread', async function() {
      this.timeout(0);
      const { __zigar, save } = await importTest('open-and-write-to-file-in-main-thread');
      const chunks = [];
      let event;
      __zigar.on('open', (evt) => {
        event = evt;
        return chunks;
      });
      const len = save('/hello/world', 'This is a test');
      expect(len).to.equal(14);
      expect(chunks).to.have.lengthOf(1);
      const blob = new Blob(chunks);
      const string = await blob.text();
      expect(string).to.equal('This is a test');
      expect(event).to.eql({ 
        parent: null,
        path: 'hello/world', 
        rights: { write: true }, 
        flags: { create: true, truncate: true, symlinkFollow: true },
      });
    })
    it('should open and write to file using posix functions', async function() {
      this.timeout(0);
      const { __zigar, save } = await importTest('open-and-write-to-file-with-posix-functions');
      const chunks = [];
      let event;
      __zigar.on('open', (evt) => {
        event = evt;
        return chunks;
      });
      const len = save('/hello/world', 'This is a test');
      expect(len).to.equal(14);
      expect(chunks).to.have.lengthOf(1);
      const blob = new Blob(chunks);
      const string = await blob.text();
      expect(string).to.equal('This is a test');
      expect(event).to.eql({ 
        parent: null,
        path: 'hello/world', 
        rights: { write: true }, 
        flags: { create: true, truncate: true, symlinkFollow: true },
      });
    })
    it('should open and write to file using libc functions', async function() {
      this.timeout(0);
      const { __zigar, save } = await importTest('open-and-write-to-file-with-libc-functions');
      const chunks = [];
      let event;
      __zigar.on('open', (evt) => {
        event = evt;
        return chunks;
      });
      const len = save('/hello/world', 'This is a test');
      expect(len).to.equal(14);
      expect(chunks).to.have.lengthOf(1);
      const blob = new Blob(chunks);
      const string = await blob.text();
      expect(string).to.equal('This is a test');
      expect(event).to.eql({ 
        parent: null,
        path: 'hello/world', 
        rights: { write: true }, 
        flags: { create: true, truncate: true, symlinkFollow: true },
      });
    })
    it('should decompress xz file', async function() {
      this.timeout(0);
      const {
        startup,
        shutdown,
        decompress,
      } = await importTest('decompress', { multithreaded: true });
      startup(1);
      try {
        const inputPath = absolute('./data/test.txt.xz');
        const input = await open(inputPath);
        const inStream = input.readableWebStream();
        const reader = inStream.getReader();
        const outputPath = absolute('./data/decompressed.txt');
        const output = await open(outputPath, 'w');
        const outStream = new WritableStream(output);
        const writer = outStream.getWriter();
        await decompress(reader, writer);
        input.close();
        output.close();
        // Uint8Array as input, array as output
        const content = await readFile(inputPath);
        const chunks = [];
        await decompress(content, chunks);
        const blob = new Blob(chunks);
        const text = await blob.text();
        expect(text).to.contain('Four score');
        expect(text).to.contain('shall not perish from the earth');
      } finally {
        await shutdown();
      }
    })
    it('should print stats of an Uint8Array passed as a file', async function() {
      this.timeout(0);
      const { print } = await importTest('stat-opened-file');
      const array = new Uint8Array(17);
      const lines = await capture(() => print(array));
      expect(lines).to.eql([
        'size = 17',
        'ctime = 0',
        'mtime = 0',
        'atime = 0',
      ]);
    })
    it('should print stats of an opened file using posix function', async function() {
      this.timeout(0);
      const { __zigar, print } = await importTest('stat-opened-file-with-posix-function');
      const array = new Uint8Array(17);
      __zigar.on('open', () => {
        return array;
      });
      const lines1 = await capture(() => print('/hello.txt'));
      expect(lines1).to.eql([
        'size = 17',
        'ctime = 0,0',
        'mtime = 0,0',
        'atime = 0,0',
      ]);
      let event;
      __zigar.on('stat', (evt) => {
        event = evt;
        return {
          size: 17n,
          ctime: 2_500_000_000n,
          mtime: 123_000_000_001n,
          atime: 1_000_000_000n,
        };
      });
      const lines2 = await capture(() => print('/hello.txt'));
      expect(event).to.eql({
        parent: null,
        path: 'hello.txt',
        target: array,
        flags: {},
      });
      expect(lines2).to.eql([
        'size = 17',
        'ctime = 2,500000000',
        'mtime = 123,1',
        'atime = 1,0',
      ]);
    })
    it('should print stats of file referenced by path using posix function', async function() {
      this.timeout(0);
      const { __zigar, print, printLink } = await importTest('stat-file-by-path-with-posix-function');
      const path = '/hello.txt';
      let event;
      __zigar.on('stat', (evt) => {
        event = evt;
        return {
          size: 34,
          ctime: 1234,
          mtime: 4567,
          atime: 9999,
        }
      });
      const lines1 = await capture(() => print(path));
      expect(event).to.eql({ 
        parent: null,
        path: 'hello.txt', 
        flags: { symlinkFollow: true } 
      });
      expect(lines1).to.eql([
        'size = 34',
        'ctime = 0,1234',
        'mtime = 0,4567',
        'atime = 0,9999',
      ]);
      __zigar.on('stat', () => false);
      expect(() => print(path)).to.throw(Error)
        .with.property('message', 'Unable to get stat');
      __zigar.on('stat', () => {
        throw new Error('Doh!');
      });
      const [ error ] = await captureError(async () => {
        expect(() => print(path)).to.throw(Error)
      });
      expect(error).to.equal('Error: Doh!');
      __zigar.on('stat', (evt) => {
        event = evt;
        return {
          size: 4,
          ctime: 123_000_000_000n,
          mtime: 456_000_000_000n,
          atime: 999_000_000_000n,
        }
      });
      const lines2 = await capture(() => printLink(path));
      expect(event).to.eql({ 
        parent: null,
        path: 'hello.txt', 
        flags: {} 
      });
      expect(lines2).to.eql([
        'size = 4',
        'ctime = 123,0',
        'mtime = 456,0',
        'atime = 999,0',
      ]);
    })
    it('should set access and last modified time of an opened file using posix function', async function() {
      this.timeout(0);
      const { __zigar, setTimes } = await importTest('set-times-of-opened-file-with-posix-function');
      const array = new Uint8Array(17);
      __zigar.on('open', () => {
        return array;
      });
      let event;
      __zigar.on('set_times', (evt) => {
        event = evt;
        return true;
      })
      setTimes('/world/hello.txt', 123, 456);
      expect(event).to.eql({
        parent: null,
        path: 'world/hello.txt',
        target: array,
        times: { atime: 123000025000n, mtime: 456000055000n },
        flags: {},
      });
      __zigar.on('set_times', (evt) => {
        return false;
      })
      expect(() => setTimes('/world/hello.txt', 123, 456)).to.throw(Error)
        .with.property('message', 'Unable to set times');
    })
    it('should set access and last modified time of a file by using posix function', async function() {
      this.timeout(0);
      const { __zigar, setTimes, setLinkTimes } = await importTest('set-times-of-file-by-path-with-posix-function');
      let event;
      __zigar.on('set_times', (evt) => {
        event = evt;
        return true;
      });
      setTimes('/world/hello.txt', 123, 456);
      expect(event).to.eql({
        parent: null,
        path: 'world/hello.txt',
        times: { atime: 123000025000n, mtime: 456000055000n },
        flags: { symlinkFollow: true }
      });
      __zigar.on('set_times', (evt) => {
        return false;
      })
      expect(() => setTimes('/world/hello.txt', 123, 456)).to.throw(Error)
        .with.property('message', 'Unable to set times');
      __zigar.on('set_times', (evt) => {
        event = evt;
        return true;
      });
      setLinkTimes('/world/hello.txt', 123, 456);
      expect(event).to.eql({
        parent: null,
        path: 'world/hello.txt',
        times: { atime: 123000025000n, mtime: 456000055000n },
        flags: {}
      });
    })
    it('should print directory contents', async function() {
      this.timeout(0);
      const { print } = await importTest('read-directory');
      const map1 = new Map([
        [ 'hello.txt', { type: 'file' } ],
        [ 'world', { type: 'directory' } ],
      ]);
      const lines1 = await capture(() => print(map1));
      expect(lines1).to.eql([ 'hello.txt file', 'world directory' ]);
      const initializers = [];
      for (let i = 0; i < 100; i++) {
        const name = 'x'.repeat(i + 1) + '.txt';
        initializers.push([ name, { type: 'file' } ]);
      }
      const map2 = new Map(initializers)
      const lines2 = await capture(() => print(map2));
      expect(lines2).to.have.lengthOf(100);
    })
    it('should perform sync operation using posix function', async function() {
      this.timeout(0);
      const { __zigar, save } = await importTest('perform-sync-with-posix-function');
      const chunks = [];
      __zigar.on('open', (evt) => {
        return chunks;
      });
      // should work when stream does not implement sync()
      save('/hello/world', 'This is a test');
      const blob = new Blob(chunks);
      const string = await blob.text();
      expect(string).to.equal('This is a test');
      let called = false;
      __zigar.on('open', (evt) => {
        return {
          write() {
          },
          sync() {
            called = true;
          },
        };
      });
      save('/hello/world', 'This is a test');
      expect(called).to.be.true;
    })
    it('should perform datasync operation using posix function', async function() {
      this.timeout(0);
      const { __zigar, save } = await importTest('perform-datasync-with-posix-function');
      const chunks = [];
      __zigar.on('open', (evt) => {
        return chunks;
      });
      // should work when stream does not implement datasync()
      save('/hello/world', 'This is a test');
      const blob = new Blob(chunks);
      const string = await blob.text();
      expect(string).to.equal('This is a test');
      let called = false;
      __zigar.on('open', (evt) => {
        return {
          write() {
          },
          datasync() {
            called = true;
          },
        };
      });
      save('/hello/world', 'This is a test');
      expect(called).to.be.true;
    })
    it('should perform advise operation using posix function', async function() {
      this.timeout(0);
      const { __zigar, save } = await importTest('perform-advise-with-posix-function');
      const chunks = [];
      __zigar.on('open', (evt) => {
        return chunks;
      });
      // should work when stream does not implement sync()
      save('/hello/world', 'This is a test');
      const blob = new Blob(chunks);
      const string = await blob.text();
      expect(string).to.equal('This is a test');
      let called = false, args;
      __zigar.on('open', (evt) => {
        return {
          write() {
          },
          advise(...a) {
            called = true;
            args = a;
          },
        };
      });
      save('/hello/world', 'This is a test');
      expect(called).to.be.true;
      expect(args).to.eql([ 5n, 1000n, 'random' ]);
    })
    it('should perform allocate operation using posix function', async function() {
      this.timeout(0);
      const { __zigar, save } = await importTest('perform-allocate-with-posix-function');
      const chunks = [];
      __zigar.on('open', (evt) => {
        return chunks;
      });
      // should fail when stream does not implement allocate()
      const [ error ] = await captureError(() => {
        expect(() => save('/hello/world', 'This is a test')).to.throw(Error)
          .with.property('message', 'Allocation failed');
      })
      expect(error).to.contain('allocate is not a function');
      let called = false, args;
      __zigar.on('open', (evt) => {
        return {
          write() {
          },
          allocate(...a) {
            called = true;
            args = a;
          },
        };
      });
      save('/hello/world', 'This is a test');
      expect(called).to.be.true;
      expect(args).to.eql([ 0n, 1000n ]);
    })
    it('should print contents of files in directory', async function() {
      this.timeout(0);
      const { __zigar, print } = await importTest('open-file-from-directory');
      __zigar.on('open', ({ parent, path }) => {
        const entry = parent.get(path);
        const text = entry.content;
        const encoder = new TextEncoder();
        return encoder.encode(text);
      });
      const map = new Map([
        [ 'hello.txt', { type: 'file', content: 'Hello world' } ],
        [ 'test.txt', { type: 'file', content: 'This is a test and this is only a test' } ],
        [ 'world', { type: 'directory' } ],
      ]);
      const lines = await capture(() => print(map));
      expect(lines).to.eql([
        'hello.txt:',
        'Hello world',
        'test.txt:',
        'This is a test and this is only a test',        
      ])
    })
    it('should print names of files in directory using posix functions', async function() {
      this.timeout(0);
      const { __zigar, print } = await importTest('scan-directory-with-posix-functions');
      const map = new Map([
        [ 'hello.txt', { type: 'file', content: 'Hello world' } ],
        [ 'test.txt', { type: 'file', content: 'This is a test and this is only a test' } ],
        [ 'world', { type: 'directory' } ],
      ]);
      let event;
      __zigar.on('open', (evt) => {
        if (evt.path === 'somewhere/directory') {
          event = evt;
          return map;
        } else {
          return false;
        }
      });
      const lines = await capture(() => print('/somewhere/directory'));
      expect(lines).to.eql([
        '. (dir)',
        '.. (dir)',
        'hello.txt (file)',
        'test.txt (file)',
        'world (dir)',
      ]);
      expect(event).to.eql({
        parent: null,
        path: 'somewhere/directory',
        rights: { readdir: true },
        flags: { symlinkFollow: true, directory: true }
      });
    })
    it('should create a directory using posix function', async function() {
      this.timeout(0);
      const { __zigar, create } = await importTest('create-directory-with-posix-function');
      let event;
      __zigar.on('mkdir', (evt) => {
        event = evt;
        return true;
      });
      create('/hello/world');
      expect(event).to.eql({ parent: null, path: 'hello/world' });
    })
    it('should remove a directory using posix function', async function() {
      this.timeout(0);
      const { __zigar, remove } = await importTest('remove-directory-with-posix-function');
      let event;
      __zigar.on('rmdir', (evt) => {
        event = evt;
        return true;
      });
      remove('/hello/world');
      expect(event).to.eql({ parent: null, path: 'hello/world' });
    })
    it('should remove a file using posix function', async function() {
      this.timeout(0);
      const { __zigar, remove } = await importTest('remove-file-with-posix-function');
      let event;
      __zigar.on('unlink', (evt) => {
        event = evt;
        return true;
      });
      remove('/hello/world.txt');
      expect(event).to.eql({ parent: null, path: 'hello/world.txt' });
    })
  })
}

function absolute(relPath) {
  return fileURLToPath(new URL(relPath, import.meta.url));
}
