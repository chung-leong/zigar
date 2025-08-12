import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { open, readFile } from 'fs/promises';
import 'mocha-skip-if';
import { platform } from 'os';
import { fileURLToPath } from 'url';
import { InvalidArgument } from '../../../../zigar-runtime/src/errors.js';
import { usize } from '../../../../zigar-runtime/src/utils.js';
import { capture, captureError, delay } from '../test-utils.js';

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
    skip.entirely.if(target !== 'linux').
    it('should open file through direct syscall', async function() {
      this.timeout(0);
      const { __zigar, check } = await importTest('open-file-through-direct-syscall');
      const content = new Uint8Array(16);
      let event;
      __zigar.on('open', (evt) => {
        event = evt;
        return content;
      });
      const result = check('/hello/world.txt');
      expect(result).to.be.true;
      expect(event).to.eql({
        parent: null,
        path: 'hello/world.txt',
        rights: { read: true },
        flags: { symlinkFollow: true }
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
    it('should open a file and seek to a particular position', async function() {
      this.timeout(0);
      const { read } = await importTest('seek-file');
      const path = absolute('./data/test.txt');
      const content = await readFile(path);
      const chunk = read(content, 32, 16);
      expect(chunk).to.have.lengthOf(16);
      expect(chunk.string).to.equal('ur fathers broug');
    })
    it('should open a file and seek to a particular position in thread', async function() {
      this.timeout(0);
      const { startup, shutdown, read } = await importTest('seek-file-in-thread', { multithreaded: true });
      startup(1);
      try {
        const path = absolute('./data/test.txt');
        const content = await readFile(path);
        const chunk = await read(content, 32, 16);
        expect(chunk).to.have.lengthOf(16);
        expect(chunk.string).to.equal('ur fathers broug');       
      } finally {
        shutdown();
      }
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
    it('should save and restore file position using using libc functions', async function() {
      this.timeout(0);
      const { __zigar, printTwice } = await importTest('save-and-restore-file-position-with-libc-functions');
      const path = absolute('./data/test.txt');
      const content = await readFile(path);
      __zigar.on('open', () => content);
      const lines = await capture(() => printTwice('/hello/world', 32, 16));
      expect(lines).to.eql([
        'ur fathers broug',
        'ur fathers broug',
      ]);
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
    it('should obtain error code using libc function', async function() {
      this.timeout(0);
      const { __zigar, triggerError } = await importTest('return-last-error-with-libc-function');
      __zigar.on('open', () => {
        return {
          read() {
            throw new InvalidArgument();
          }
        };
      });
      let result;
      const [ error ] = await captureError(() => {
        result = triggerError('/hello/world');
      });
      expect(`${result}`).to.equal('INVAL');
      expect(error).to.contain('Invalid argument');
    })
    it('should detect end of file using libc function', async function() {
      this.timeout(0);
      const { __zigar, detectEOF } = await importTest('detect-end-of-file-with-libc-function');
      __zigar.on('open', () => {
        return new Uint8Array(256);
      });
      const result = detectEOF('/hello/world');
      expect(result).to.be.true;
    })
    it('should rewind file using libc function', async function() {
      this.timeout(0);
      const { __zigar, getStartingPos } = await importTest('rewind-file-with-libc-function');
      __zigar.on('open', () => {
        return new Uint8Array(256);
      });
      const result = getStartingPos('/hello/world');
      expect(result).to.equal(usize(0));
    })
    it('should check file access using posix function', async function() {
      this.timeout(0);
      const { __zigar, check } = await importTest('check-access-with-posix-function');
      let event;
      __zigar.on('open', (evt) => {
        const { path } = event = evt;
        switch(path) {
          case 'readable.txt': 
            return new Uint8Array(256);
          case 'writable.txt':
            return [];
          case 'readwritable.txt':
            return {
              read() {},
              write() {},
            };
          case 'subdirectory':
            return new Map();
        }
      });
      expect(check('/readable.txt', { read: true })).to.be.true;
      expect(event).to.eql({
        parent: null,
        path: 'readable.txt',
        rights: { read: true },
        flags: { symlinkFollow: true, accessCheck: true }
      });
      expect(check('/readable.txt', { write: true })).to.be.true;
      expect(check('/writable.txt', { write: true })).to.be.true;
      expect(event).to.eql({
        parent: null,
        path: 'writable.txt',
        rights: { write: true },
        flags: { symlinkFollow: true, accessCheck: true }
      });
      expect(check('/writable.txt', { write: true, read: true })).to.be.false;
      expect(check('/readwritable.txt', { write: true, read: true })).to.be.true;
      expect(event).to.eql({
        parent: null,
        path: 'readwritable.txt',
        rights: { read: true, write: true },
        flags: { symlinkFollow: true, accessCheck: true }
      });
      expect(check('/readwritable.txt', { execute: true, read: true })).to.be.false;
      expect(check('/subdirectory', { execute: true })).to.be.true;
    })
    it('should check access of file in directory using posix function', async function() {
      this.timeout(0);
      const { __zigar, check } = await importTest('check-access-at-dir-with-posix-function');
      const uint8Array = new Uint8Array(256);
      const array = [];
      const submap = new Map();
      const map = new Map([
        [ 'readable.txt', uint8Array ],
        [ 'writable.txt', array ],
        [ 'subdirectory', submap ],
      ])
      let event;
      __zigar.on('open', (evt) => {
        const { path, parent } = event = evt;
        if (!parent) {
          if (path === 'world') return map;
        } else {
          return parent.get(path);
        }
      });
      const dir = '/world';
      expect(check(dir, 'readable.txt', { read: true })).to.be.true;
      expect(event).to.eql({
        parent: map,
        path: 'readable.txt',
        rights: { read: true },
        flags: { accessCheck: true }
      });
      expect(check(dir, 'readable.txt', { write: true })).to.be.true;
      expect(check(dir, 'subdirectory', { execute: true })).to.be.true;
    })
    it('should open file in directory using posix function', async function() {
      this.timeout(0);
      const { __zigar, write } = await importTest('open-file-at-dir-with-posix-function');
      const array = [];
      const map = new Map([
        [ 'writable.txt', array ],
      ])
      let event;
      __zigar.on('open', (evt) => {
        const { path, parent } = event = evt;
        if (!parent) {
          if (path === 'world') return map;
        } else {
          return parent.get(path);
        }
      });
      const dir = '/world';
      const text = 'Hello world!!!';
      const len = write(dir, '/writable.txt', text);
      const output = await new Blob(array).text();
      expect(output).to.equal(text);    
      expect(len).to.equal(text.length);
      expect(event).to.eql({
        parent: map,
        path: 'writable.txt',
        rights: { write: true },
        flags: { symlinkFollow: true }
      });
    })
    it('should print stat of file in directory using posix function', async function() {
      this.timeout(0);
      const { __zigar, stat } = await importTest('stat-file-at-dir-with-posix-function');
      const typeArray = new Uint8Array(256);
      const map = new Map([
        [ 'readable.txt', typeArray ],
      ])
      let event;
      __zigar.on('open', (evt) => {
        const { path, parent } = evt;
        if (!parent) {
          if (path === 'world') return map;
        } else {
          return parent.get(path);
        }
      });
      __zigar.on('stat', (evt) => {
        const { path, parent } = event = evt;
        const file = parent?.get?.(path);
        if (!file) return false;
        return {
          size: file.length,
          ctime: 123n * 1_000_000_000n + 1n,
          mtime: 124n * 1_000_000_000n + 2n,
          atime: 125n * 1_000_000_000n + 3n,
        }
      });
      const dir = '/world';
      const lines = await capture(() => stat(dir, '/readable.txt'));
      expect(lines).to.eql([ 
        'size = 256',
        'ctime = 123,1',
        'mtime = 124,2',
        'atime = 125,3' 
      ]);
      expect(event).to.eql({
        parent: map,
        path: 'readable.txt',
        flags: { symlinkFollow: true }
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
    it('should set access and last modified time of an opened file using posix function with ns precision', async function() {
      this.timeout(0);
      const { __zigar, setTimes } = await importTest('set-ns-times-of-opened-file-with-posix-function');
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
        times: { atime: 123000000025n, mtime: 456000000055n },
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
    it('should set access and last modified time of a file in directory using posix function', async function() {
      this.timeout(0);
      const { __zigar, setTimes } = await importTest('set-times-of-file-at-dir-with-posix-function');
      let event;
      const map = new Map();
      __zigar.on('open', (evt) => {
        return map;
      });
      __zigar.on('set_times', (evt) => {
        event = evt;
        return true;
      });
      setTimes('/world', '/hello.txt', 123, 456);
      expect(event).to.eql({
        parent: map,
        path: 'hello.txt',
        times: { atime: 123000000025n, mtime: 456000000055n },
        flags: {}
      });
      __zigar.on('set_times', (evt) => {
        return false;
      })
      expect(() => setTimes('/world', '/hello.txt', 123, 456)).to.throw(Error)
        .with.property('message', 'Unable to set times');
    })
    it('should print directory contents', async function() {
      this.timeout(0);
      const { print } = await importTest('read-directory');
      const map1 = new Map([
        [ 'hello.txt', { type: 'file' } ],
        [ 'world', { type: 'directory' } ],
      ]);
      const lines1 = await capture(() => print(map1));
      map1.close();
      expect(lines1).to.eql([ 'hello.txt file', 'world directory' ]);
      const initializers = [];
      for (let i = 0; i < 100; i++) {
        const name = 'x'.repeat(i + 1) + '.txt';
        initializers.push([ name, { type: 'file' } ]);
      }
      const map2 = new Map(initializers);
      const lines2 = await capture(() => print(map2));
      map2.close();
      expect(lines2).to.have.lengthOf(100);
    })
    it('should print directory contents in thread', async function() {
      this.timeout(0);
      const { startup, shutdown, print } = await importTest('read-directory-in-thread', { multithreaded: true });
      startup(1);
      try {
        const map1 = new Map([
          [ 'hello.txt', { type: 'file' } ],
          [ 'world', { type: 'directory' } ],
        ]);
        const lines1 = await capture(() => print(map1));
        map1.close();
        expect(lines1).to.eql([ 'hello.txt file', 'world directory' ]);
        const initializers = [];
        for (let i = 0; i < 100; i++) {
          const name = 'x'.repeat(i + 1) + '.txt';
          initializers.push([ name, { type: 'file' } ]);
        }
        const map2 = new Map(initializers);
        const lines2 = await capture(() => print(map2));
        map2.close();
        expect(lines2).to.have.lengthOf(100);
      } finally {
        shutdown();
      }
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
    skip.entirely.unless(target === 'linux').
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
    skip.entirely.unless(target === 'linux').
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
    skip.entirely.unless(target === 'linux').
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
      expect(error).to.contain('allocate');
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
        if (!parent) return null;
        const entry = parent?.get(path);
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
    it('should open and read from file using pread', async function() {
      this.timeout(0);
      const { __zigar, readAt } = await importTest('open-and-read-file-with-pread');
      const path = absolute('./data/test.txt');
      const content = await readFile(path);
      __zigar.on('open', (evt) => {
        return content;
      });
      const chunk = readAt('/hello/world', 120n, 16n);
      expect(chunk.string).to.equal('cated to the pro');
    })
    it('should open and write into file using pwrite', async function() {
      this.timeout(0);
      const { __zigar, writeAt } = await importTest('open-and-write-file-with-pwrite');
      const array = new Uint8Array(256);
      __zigar.on('open', (evt) => {
        return array;
      });
      const written = writeAt('/hello/world', 'Hello world', 120n);
      expect(written).to.equal(11);
      const subarray = array.slice(120, 120 + 11);
      const text = new TextDecoder().decode(subarray);
      expect(text).to.equal('Hello world');
    })
    it('should set lock on file using fcntl', async function() {
      this.timeout(0);
      const { lock } = await importTest('set-lock-with-fcntl');
      const file1 = {
        read() {},
        setlock(lock) {
          if (!this.lock) {
            this.lock = lock;
            return true;
          } else {
            return false;
          }
        }
      };
      lock(file1);
      expect(file1.lock).to.eql({ type: 1, whence: 0, start: 1234n, len: 8000n, pid: 123 });
      expect(() => lock(file1)).to.throw(Error).with.property('message').that.contains('Locked');
      const file2 = {
        read() {},
      };
      expect(() => lock(file2)).to.not.throw();
    })
    it('should set lock on file', async function() {
      this.timeout(0);
      const { lock, unlock } = await importTest('set-lock-on-file');
      const file = {
        read() {},
        setlock(lock) {
          if (!this.lock) {
            if (lock.type !== 2) {
              this.lock = lock;
              return true;
            }
          } else {
            if (lock.type === 2) {
              this.lock = null;
              return true;
            }
          }
          return false;
        }
      };
      const result1 = lock(file);
      expect(result1).to.be.true;
      expect(file.lock).to.eql({ type: 1, whence: 0, start: 0n, len: 0n, pid: 0 });
      const result2 = lock(file);
      expect(result2).to.be.false;
      const result3 = unlock(file);
      expect(result3).to.be.true;
      expect(file.lock).to.be.null;
    })
    it('should get lock on file using fcntl', async function() {
      this.timeout(0);
      const { check } = await importTest('get-lock-with-fcntl');
      const file1 = {
        read() {},
        getlock(lock) {}
      };
      expect(check(file1)).to.be.null;
      const file2 = {
        read() {},
      };
      expect(check(file2)).to.be.null;
      const file3 = {
        read() {},
        getlock(lock) {
          return { ...lock, type: 0 };
        }
      };
      const lock = check(file3).valueOf();
      expect(lock).to.eql({ type: 0, whence: 0, start: 1234n, len: 8000n, pid: 123 });
    })
    it('should set lock on file using posix function', async function() {
      this.timeout(0);
      const { lock, unlock } = await importTest('set-lock-with-posix-function');
      const file = {
        read() {},
        setlock(lock) {
          if (!this.lock) {
            if (lock.type !== 2) {
              this.lock = lock;
              return true;
            }
          } else {
            if (lock.type === 2) {
              this.lock = null;
              return true;
            }
          }
          return false;
        }
      };
      const result1 = lock(file);
      expect(result1).to.be.true;
      expect(file.lock).to.eql({ type: 1, whence: 0, start: 0n, len: 0n, pid: 0 });
      const result2 = lock(file);
      expect(result2).to.be.false;
      const result3 = unlock(file);
      expect(result3).to.be.true;
      expect(file.lock).to.be.null;
    })
    it('should set lock on file inside thread', async function() {
      this.timeout(0);
      const { spawn, startup, shutdown } = await importTest('set-lock-on-file-in-thread', { multithreaded: true });
      const file = {
        chunks: [],

        write(chunk) {
          this.chunks.push(chunk);
        },
        setlock(lock, wait) {
          if (!this.lock && wait) {
            this.lock = lock;
            return delay(500).then(() => true);
          } else if (lock.type == 2) {
            this.lock = null;
            return true;
          }
          return false;
        }
      };
      startup();
      try {
        const written = await spawn(file);
        expect(written).to.equal(11);
        // wait a moment for the file to be unlocked
        await delay(50);
        expect(file.lock).to.be.null;
      } finally {
        shutdown();
      }
    })
    it('should set no-blocking flag of descriptor using fcntl', async function() {
      this.timeout(0);
      const { print, startup, shutdown } = await importTest('set-non-blocking-flag-with-fcntl', { multithreaded: true });
      const path = absolute('./data/macbeth.txt');
      const content = await readFile(path);
      const stream = new ReadableStream({
        pos: 0,
        async pull(controller) {
          const chunk = content.subarray(this.pos, this.pos + 64);
          if (chunk.length > 0) {
            this.pos += chunk.length;
            controller.enqueue(chunk);
          } else {
            controller.close();
          }
        }
      });
      const reader = stream.getReader();
      startup();
      try {
        const lines = await capture(() => print(reader));
        const line = lines.find(s => s.includes('Signifying nothing'));
        expect(line).to.be.a('string');
      } finally {
        shutdown();
      }
      reader.close();
    })
    it('should read lines from file using fgets', async function() {
      this.timeout(0);
      const { print, startup, shutdown } = await importTest('read-line-from-file-with-fgets', { multithreaded: true });
      const path = absolute('./data/macbeth.txt');
      const content = await readFile(path);
      const stream = new ReadableStream({
        pos: 0,
        async pull(controller) {
          const chunk = content.subarray(this.pos, this.pos + 64);
          if (chunk.length > 0) {
            this.pos += chunk.length;
            controller.enqueue(chunk);
          } else {
            controller.close();
          }
        }
      });
      const reader = stream.getReader();
      startup();
      try {
        const lines = await capture(() => print(reader));
        const line = lines.find(s => s.includes('Signifying nothing'));
        expect(line).to.be.a('string');
      } finally {
        shutdown();
      }
      reader.close();
    })
    it('should read lines from stdin using fgets', async function() {
      this.timeout(0);
      const { __zigar, print, startup, shutdown } = await importTest('read-line-from-stdin-with-fgets', { multithreaded: true });
      const path = absolute('./data/macbeth.txt');
      const content = await readFile(path);
      const stream = new ReadableStream({
        pos: 0,
        async pull(controller) {
          const chunk = content.subarray(this.pos, this.pos + 64);
          if (chunk.length > 0) {
            this.pos += chunk.length;
            controller.enqueue(chunk);
          } else {
            controller.close();
          }
        }
      });
      const reader = stream.getReader();
      __zigar.redirect(0, reader);
      startup();
      try {
        const lines = await capture(() => print());
        const line = lines.find(s => s.includes('Signifying nothing'));
        expect(line).to.be.a('string');
      } finally {
        shutdown();
      }
      reader.close();
    })
    skip.entirely.unless(target == 'windows').
    it('should read lines from stdin using gets_s', async function() {
      this.timeout(0);
      const { __zigar, print, startup, shutdown } = await importTest('read-line-from-stdin-with-gets_s', { multithreaded: true });
      const path = absolute('./data/macbeth.txt');
      const content = await readFile(path);
      const stream = new ReadableStream({
        pos: 0,
        async pull(controller) {
          const chunk = content.subarray(this.pos, this.pos + 64);
          if (chunk.length > 0) {
            this.pos += chunk.length;
            controller.enqueue(chunk);
          } else {
            controller.close();
          }
        }
      });
      const reader = stream.getReader();
      __zigar.redirect(0, reader);
      startup();
      try {
        print();
        const lines = await capture(() => {});
        const line = lines.find(s => s.includes('Signifying nothing'));
        expect(line).to.be.a('string');
      } finally {
        shutdown();
      }
      reader.close();
    })
    it('should scan variables from a file using fscanf', async function() {
      // C is needed for this test since varargs handling in Zig is still dodgy
      this.timeout(0);
      const { scan } = await importTest('c/scan-file-with-fscanf');
      const input = [
        '1 2 3 hello',
        '4 5 6 world',
        '123 456',
      ];
      const data = new TextEncoder().encode(input.join('\n'));
      const lines = await capture(() => scan(data));
      expect(lines).to.eql([
        '1 2 3 hello',
        '4 5 6 world',
        'count = 2',
      ]);
    })
    it('should scan variables from a stdin using scanf', async function() {
      // ditto
      this.timeout(0);
      const { __zigar, scan } = await importTest('c/scan-stdin-with-scanf');
      const input = [
        '1 2 3 hello',
        '4 5 6 world',
        '123 456',
      ];
      const data = new TextEncoder().encode(input.join('\n'));
      __zigar.redirect(0, data);
      const lines = await capture(() => scan());
      expect(lines).to.eql([
        '1 2 3 hello',
        '4 5 6 world',
        'count = 2',
      ]);
    })
    it('should get characters from a file using fgetc', async function() {
      this.timeout(0);
      const { print } = await importTest('read-file-content-with-fgetc');
      const path = absolute('./data/macbeth.txt');
      const content = await readFile(path);
      const lines = await capture(() => print(content));
      const line = lines.find(s => s.includes('Signifying nothing'));
      expect(line).to.be.a('string');
    })
    it('should get characters from stdin using getchar', async function() {
      this.timeout(0);
      const { __zigar, print } = await importTest('read-stdin-with-getchar');
      const path = absolute('./data/macbeth.txt');
      const content = await readFile(path);
      __zigar.redirect(0, content);
      const lines = await capture(() => print());
      const line = lines.find(s => s.includes('Signifying nothing'));
      expect(line).to.be.a('string');
    })
    it('should push character into stdin using ungetc', async function() {
      this.timeout(0);
      const { __zigar, push, get } = await importTest('push-character-into-stdin-with-ungetc');
      const content = new Uint8Array([ 1, 2, 3, 4 ]);
      __zigar.redirect(0, content);
      push(5);
      const result1 = get();
      expect(result1).to.equal(5);
      const result2 = get();
      expect(result2).to.equal(1);
      push(6);
      push(7);
      const result3 = get();
      expect(result3).to.equal(7);
      const result4 = get();
      expect(result4).to.equal(6);
      const result5 = get();
      expect(result5).to.equal(2);
    })
    it('should flush open file using fflush', async function() {
      this.timeout(0);
      const { __zigar, open, close, write, writeFlush, writeFlushAll } = await importTest('flush-buffer-with-fflush');
      const array = [];
      __zigar.on('open', (evt) => array);
      open('/hello.txt');
      try {
        writeFlush('Hello world');
        expect(array).to.have.lengthOf(1);
        writeFlushAll('Hello world');
        expect(array).to.have.lengthOf(2);
        write('Hello world');
        expect(array).to.have.lengthOf(2);
      } finally{
        close();
      }
      expect(array).to.have.lengthOf(3);
    })
  })
}

function absolute(relPath) {
  return fileURLToPath(new URL(relPath, import.meta.url));
}
