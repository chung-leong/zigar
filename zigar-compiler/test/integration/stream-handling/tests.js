import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { execSync } from 'child_process';
import { mkdir, open, readFile, rmdir, stat, unlink, writeFile } from 'fs/promises';
import 'mocha-skip-if';
import { arch, platform } from 'os';
import { fileURLToPath } from 'url';
import { InvalidArgument } from '../../../../zigar-runtime/src/errors.js';
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
    this.timeout(0);
    it('should read from reader', async function() {
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
      if (target === 'wasm32') {
        expect(event).to.eql({ 
          parent: null,
          path: 'hello/world', 
          rights: { read: true }, 
          flags: {}, 
        });
      } else {
        expect(event).to.eql({ 
          parent: null,
          path: 'hello/world', 
          rights: { read: true, readdir: true }, 
          flags: { symlinkFollow: true }, 
        });
      }
    })
    it('should fallback to the system when open handler returns undefined', async function() {
      const { __zigar, hash } = await importTest('open-and-read-from-file-system');
      if (target === 'wasm32') {
        const { WASI } = await import('wasi');
        __zigar.wasi(new WASI({
          version: 'preview1',
          args: [],
          env: {},
          preopens: {
            '/': '/',
          },
        }));
      }
      const correct = (platform() === 'win32') 
      ? '8b25078fffd077f119a53a0121a560b3eba816a0' 
      : 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
      const path = absolute('./data/test.txt');
      let event;
      __zigar.on('open', (evt) => {
        event = evt;
        return undefined;
      });
      const digest = hash(path);
      expect(digest.string).to.equal(correct);
      expect(event).to.be.an('object');
    })
    it('should open file thru file system using posix function', async function() {
      const { __zigar, hash } = await importTest('open-and-read-from-file-system-with-posix-function');
      if (target === 'wasm32') {
        const { WASI } = await import('wasi');
        __zigar.wasi(new WASI({
          version: 'preview1',
          args: [],
          env: {},
          preopens: {
            '/': '/',
          },
        }));
      }
      const correct = (platform() === 'win32') 
      ? '8b25078fffd077f119a53a0121a560b3eba816a0' 
      : 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
      const path = absolute('./data/test.txt');
      let event;
      __zigar.on('open', (evt) => {
        event = evt;
        return undefined;
      });
      const digest = hash(path);
      expect(digest.string).to.equal(correct);
      expect(event).to.be.an('object');
    })
    it('should open file thru file system using libc function', async function() {
      const { __zigar, hash } = await importTest('open-and-read-from-file-system-with-libc-function');
      if (target === 'wasm32') {
        const { WASI } = await import('wasi');
        __zigar.wasi(new WASI({
          version: 'preview1',
          args: [],
          env: {},
          preopens: {
            '/': '/',
          },
        }));
      }
      const correct = (platform() === 'win32') 
      ? '8b25078fffd077f119a53a0121a560b3eba816a0' 
      : 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
      const path = absolute('./data/test.txt');
      let event;
      __zigar.on('open', (evt) => {
        event = evt;
        return undefined;
      });
      const digest = hash(path);
      expect(digest.string).to.equal(correct);
      expect(event).to.be.an('object');
    })
    it('should not attempt io redirection when feature is disabled', async function() {
      const { __zigar, check } = await importTest('open-and-close-file', { useRedirection: false, topLevelAwait: false });
      if (target === 'wasm32') {
        const { WASI } = await import('wasi');
        __zigar.wasi(new WASI({
          version: 'preview1',
          args: [],
          env: {},
          preopens: {
            '/': '/',
          },
        }));
      }
      await __zigar.init();
      const path = absolute('./data/test.txt');
      let event;
      __zigar.on('open', (evt) => {
        console.log(evt);
        event = evt;
        return undefined;
      });
      check(path);
      expect(event).to.be.undefined;
    })
    skip.entirely.if(target !== 'linux').
    it('should open file through direct syscall', async function() {
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
        rights: { read: true, readdir: true },
        flags: { symlinkFollow: true }
      });
    })
    it('should open and read from file using posix functions', async function() {
      const { __zigar, hash } = await importTest('open-and-read-file-with-posix-functions', { useLibc: true });
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
        rights: { read: true, readdir: true }, 
        flags: { symlinkFollow: true }, 
      });
    })
    it('should open and read from file using libc functions', async function() {
      const { __zigar, hash } = await importTest('open-and-read-file-with-libc-functions', { useLibc: true });
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
        rights: { read: true, readdir: true }, 
        flags: { symlinkFollow: true }, 
      });
    })
    it('should open a file and seek to a particular position', async function() {
      const { read } = await importTest('seek-file');
      const path = absolute('./data/test.txt');
      const content = await readFile(path);
      const chunk = read(content, 32, 16);
      expect(chunk).to.have.lengthOf(16);
      expect(chunk.string).to.equal('ur fathers broug');
    })
    it('should open a file and seek to a particular position in thread', async function() {
      const { startup, shutdown, read } = await importTest('seek-file-in-thread', { multithreaded: true });
      startup(1);
      try {
        const path = absolute('./data/test.txt');
        const content = await readFile(path);
        const chunk = await read(content, 32, 16);
        expect(chunk).to.have.lengthOf(16);
        expect(chunk.string).to.equal('ur fathers broug');       
      } finally {
        await shutdown();;
      }
    })
    it('should open a file and seek to a particular position using posix function', async function() {
      const { __zigar, read } = await importTest('seek-file-with-posix-functions', { useLibc: true });
      const path = absolute('./data/test.txt');
      const content = await readFile(path);
      __zigar.on('open', () => content);
      const chunk = read('/hello/world', 32, 16);
      expect(chunk).to.have.lengthOf(16);
      expect(chunk.string).to.equal('ur fathers broug');
    })
    it('should open a file and seek to a particular position using libc function', async function() {
      const { __zigar, read } = await importTest('seek-file-with-libc-functions', { useLibc: true });
      const path = absolute('./data/test.txt');
      const content = await readFile(path);
      __zigar.on('open', () => content);
      const chunk = read('/hello/world', 32, 16);
      expect(chunk).to.have.lengthOf(16);
      expect(chunk.string).to.equal('ur fathers broug');
    })
    skip.entirely.unless(target === 'win32').
    it('should open a file and seek to a particular position using win32 function', async function() {
      const { read } = await importTest('seek-file-with-win32-function');
      const path = absolute('./data/test.txt');
      const content = await readFile(path);
      const chunk = read(content, 32, 16);
      expect(chunk).to.have.lengthOf(16);
      expect(chunk.string).to.equal('ur fathers broug');
    })
    it('should obtain the expected position after a seek operation using posix function', async function() {
      const { __zigar, seek } = await importTest('return-file-position-with-posix-functions', { useLibc: true });
      const content = new TextEncoder().encode('Hello world!');
      __zigar.on('open', () => content);
      const pos = seek('/hello/world', -2);
      expect(pos).to.equal(content.length - 2);
    })
    it('should obtain the expected position after a seek operation using libc function', async function() {
      const { __zigar, seek } = await importTest('return-file-position-with-libc-functions', { useLibc: true });
      const content = new TextEncoder().encode('Hello world!');
      __zigar.on('open', () => content);
      const pos = seek('/hello/world', -2);
      expect(pos).to.equal(content.length - 2);
    })
    it('should save and restore file position using using libc functions', async function() {
      const { __zigar, printTwice } = await importTest('save-and-restore-file-position-with-libc-functions', { useLibc: true });
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
      if (target === 'wasm32') {
        expect(event).to.eql({ 
          parent: null,
          path: 'hello/world', 
          rights: { write: true }, 
          flags: { create: true, truncate: true },
        });
      } else {
        expect(event).to.eql({ 
          parent: null,
          path: 'hello/world', 
          rights: { write: true }, 
          flags: { create: true, truncate: true, symlinkFollow: true },
        });
      }
    })
    it('should open and write to file using posix functions', async function() {
      const { __zigar, save } = await importTest('open-and-write-to-file-with-posix-functions', { useLibc: true });
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
      const { __zigar, save } = await importTest('open-and-write-to-file-with-libc-functions', { useLibc: true });
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
    skip.entirely.unless(target === 'win32').
    it('should open and write to file using win32 functions', async function() {
      const { __zigar, save } = await importTest('open-and-write-to-file-with-win32-functions');
      const chunks = [];
      let event;
      __zigar.on('open', (evt) => {
        event = evt;
        return chunks;
      });
      const len = save('\\hello\\world', 'This is a test');
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
      const { __zigar, triggerError } = await importTest('return-last-error-with-libc-function', { useLibc: true });
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
      if (target === 'wasm32') {
        expect(`${result}`).to.equal('2BIG');
      } else {
        expect(`${result}`).to.equal('INVAL');
      }
      expect(error).to.contain('Invalid argument');
    })
    it('should detect end of file using libc function', async function() {
      const { __zigar, detectEOF } = await importTest('detect-end-of-file-with-libc-function', { useLibc: true });
      __zigar.on('open', () => {
        return new Uint8Array(256);
      });
      const result = detectEOF('/hello/world');
      expect(result).to.be.true;
    })
    it('should rewind file using libc function', async function() {
      const { __zigar, getStartingPos } = await importTest('rewind-file-with-libc-function', { useLibc: true });
      __zigar.on('open', () => {
        return new Uint8Array(256);
      });
      const result = getStartingPos('/hello/world');
      expect(result).to.equal(0);
    })
    it('should check file access using posix function', async function() {
      const { __zigar, check } = await importTest('check-access-with-posix-function', { useLibc: true });
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
        rights: {},
        flags: { symlinkFollow: true, dryrun: true }
      });
      expect(check('/readable.txt', { write: true })).to.be.true;
      expect(check('/writable.txt', { write: true })).to.be.true;
      expect(event).to.eql({
        parent: null,
        path: 'writable.txt',
        rights: {},
        flags: { symlinkFollow: true, dryrun: true }
      });
      expect(check('/writable.txt', { write: true, read: true })).to.be.true;
      expect(check('/readwritable.txt', { write: true, read: true })).to.be.true;
      expect(event).to.eql({
        parent: null,
        path: 'readwritable.txt',
        rights: {},
        flags: { symlinkFollow: true, dryrun: true }
      });
      if (target !== 'win32' && target !== 'wasm32') {  // no checking for executability on these platforms
        expect(check('/readwritable.txt', { execute: true, read: true })).to.be.false;
      }
      expect(check('/subdirectory', { execute: true })).to.be.true;
    })
    skip.entirely.if(target == 'win32').
    it('should check access of file in directory using posix function', async function() {
      const { __zigar, check } = await importTest('check-access-at-dir-with-posix-function', { useLibc: true });
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
        if (parent) {
          return parent.get(path);
        }
      });
      expect(check(map, 'readable.txt', { read: true })).to.be.true;
      expect(event).to.eql({
        parent: map,
        path: 'readable.txt',
        rights: {},
        flags: { dryrun: true, symlinkFollow: true }
      });
      expect(check(map, 'readable.txt', { write: true })).to.be.true;
      expect(check(map, 'subdirectory', { execute: true })).to.be.true;
    })
    skip.entirely.if(target === 'win32').
    it('should open file in directory using posix function', async function() {
      const { __zigar, write } = await importTest('open-file-at-dir-with-posix-function', { useLibc: true });
      const array = [];
      const map = new Map([
        [ 'writable.txt', array ],
      ])
      let event;
      __zigar.on('open', (evt) => {
        const { path, parent } = event = evt;
        if (parent) {
          return parent.get(path);
        }
      });
      const text = 'Hello world!!!';
      const len = write(map, 'writable.txt', text);
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
    skip.entirely.if(target === 'win32').
    it('should open file in directory in file system using posix function', async function() {
      const { __zigar, write } = await importTest('open-file-at-dir-in-file-system-with-posix-function', { useLibc: true });
      const path = absolute(`./data/openat_test`);
      await mkdir(path, { recursive: true });
      try {
        let event;
        __zigar.on('open', (evt) => {
          event = evt;
          return undefined;
        });
        const text = 'Hello world!!!';
        const len = write(path, 'writable.txt', text);
        expect(len).to.equal(text.length);
        const content = await readFile(`${path}/writable.txt`, 'utf8');
        expect(content).to.equal(text);
        expect(event).to.eql({
          parent: null,
          path: path.slice(1),
          rights: {
            read: true,
            readdir: true,
          },
          flags: {
            directory: true,
            symlinkFollow: true,
          },
        });
      } finally {
        try {
          await rmdir(path, { recursive: true });
        } catch {}
      }
    })
    skip.entirely.if(target === 'win32').
    it('should retrieve stat of file in directory using posix function', async function() {
      const { __zigar, stat } = await importTest('stat-file-at-dir-with-posix-function', { useLibc: true });
      const typeArray = new Uint8Array(256);
      const map = new Map([
        [ 'readable.txt', typeArray ],
      ])
      let event;
      __zigar.on('open', (evt) => {
        const { path, parent } = evt;
        if (parent) {
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
      const lines = await capture(() => stat(map, 'readable.txt'));
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
    skip.entirely.if(target === 'win32').
    it('should retrieve stat of file in directory in file system using posix function', async function() {
      const { __zigar, stat } = await importTest('stat-file-at-dir-in-file-system-with-posix-function', { useLibc: true, useRedirection: true });
      const path = absolute(`./data/statat_test`);
      await mkdir(path, { recursive: true });
      await writeFile(`${path}/file.txt`, 'Hello world');
      try {
        let event;
        __zigar.on('open', (evt) => {
          event = evt;
          return undefined;
        });
        __zigar.on('stat', (evt) => {
          event = evt;
          return undefined;
        });
        const [ line ] = await capture(() => stat(path, 'file.txt'));
        expect(line).to.eql('size = 11');
      } finally {
        try {
          await rmdir(path, { recursive: true });
        } catch {}
      }
    })
    it('should decompress xz file', async function() {
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
    it('should get stats of an Uint8Array passed as a file', async function() {
      const { __zigar, print } = await importTest('stat-opened-file');
      const array = new Uint8Array(17);
      const lines1 = await capture(() => print(array));
      expect(lines1).to.eql([
        'size = 17',
        'ctime = 0',
        'mtime = 0',
        'atime = 0',
      ]);
      let event;
      __zigar.on('stat', (evt) => {
        event = evt;
        return {
          size: 345,
          ctime: 123_000,
          mtime: 456_000,
          atime: 1_000_000_000_000,
        }
      })
      const lines2 = await capture(() => print(array));
      expect(lines2).to.eql([
        'size = 345',
        'ctime = 123000',
        'mtime = 456000',
        'atime = 1000000000000',
      ]);
      expect(event).to.eql({
        target: array,
        flags: {},
      })
    })
    it('should get stats of an opened file using posix function', async function() {
      const { __zigar, print } = await importTest('stat-opened-file-with-posix-function', { useLibc: true });
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
      if (target === 'win32') {
        // resolution is limited to seconds in Windows
        expect(lines2).to.eql([
          'size = 17',
          'ctime = 2,0',
          'mtime = 123,0',
          'atime = 1,0',
        ]);
      } else {
        expect(lines2).to.eql([
          'size = 17',
          'ctime = 2,500000000',
          'mtime = 123,1',
          'atime = 1,0',
        ]);
      }
    })
    it('should get stats of file referenced by path using posix function', async function() {
      const { __zigar, print, printLink } = await importTest('stat-file-by-path-with-posix-function', { useLibc: true });
      const path = '/hello.txt';
      let event;
      __zigar.on('stat', (evt) => {
        event = evt;
        return {
          size: 34,
          ctime: 1234 + 1_000_000_000 * 1,
          mtime: 4567 + 1_000_000_000 * 2,
          atime: 9999 + 1_000_000_000 * 3,
        }
      });
      const lines1 = await capture(() => print(path));
      expect(event).to.eql({ 
        parent: null,
        path: 'hello.txt', 
        flags: { symlinkFollow: true } 
      });
      if (target === 'win32') {
        expect(lines1).to.eql([
          'size = 34',
          'ctime = 1,0',
          'mtime = 2,0',
          'atime = 3,0',
        ]);
      } else {
        expect(lines1).to.eql([
          'size = 34',
          'ctime = 1,1234',
          'mtime = 2,4567',
          'atime = 3,9999',
        ]);
      }
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
      if (target !== 'win32') {
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
      }
    })
    skip.entirely.unless(target === 'win32').
    it('should get size of an opened file using win32 function', async function() {
      const { get, getEx } = await importTest('get-size-with-win32-function');
      const array = new Uint8Array(17);
      expect(get(array)).to.equal(17n);
      expect(getEx(array)).to.equal(17n);
    });
    skip.entirely.unless(target === 'win32').
    it('should get stats of an opened file using win32 function', async function() {
      const { __zigar, print } = await importTest('get-info-with-win32-function');
      const array = new Uint8Array(17);
      const lines1 = await capture(() => print(array));
      expect(lines1).to.eql([
        'size = 17',
        'ctime = 3577643008, 27111902',
        'atime = 3577643008, 27111902',
        'mtime = 3577643008, 27111902',
      ]);
      let event;
      __zigar.on('stat', (evt) => {
        event = evt;
        return {
          size: 12345,
          ctime: 1_000_000_000 + 100,
          atime: 1_000_000_000 + 200,
          mtime: 1_000_000_000 + 300,
        };
      });
      const lines2 = await capture(() => print(array));
      expect(lines2).to.eql([
        'size = 12345',
        'ctime = 3587643009, 27111902',
        'atime = 3587643010, 27111902',
        'mtime = 3587643011, 27111902',
      ]);
      expect(event).to.eql({
        target: array,
        flags: {},
      });
    });
    skip.entirely.if(target === 'win32').or.if(target === 'wasm32').
    it('should set access and last modified time of an opened file using posix function', async function() {
      const { __zigar, setTimes } = await importTest('set-times-of-opened-file-with-posix-function', { useLibc: true });
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
    skip.entirely.unless(target === 'win32').
    it('should set access and last modified time of an opened file using futime', async function() {
      const { __zigar, setTimes } = await importTest('set-times-of-opened-file-with-futime');
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
        times: { atime: 123000000000n, mtime: 456000000000n },
        flags: {},
      });
      __zigar.on('set_times', (evt) => {
        return false;
      })
      expect(() => setTimes('/world/hello.txt', 123, 456)).to.throw(Error)
        .with.property('message', 'Unable to set times');
    })
    skip.entirely.if(target === 'win32').
    it('should set access and last modified time of an opened file using posix function with ns precision', async function() {
      const { __zigar, setTimes } = await importTest('set-ns-times-of-opened-file-with-posix-function', { useLibc: true });
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
    skip.entirely.if(target === 'win32').
    it('should set access and last modified time of a file by using posix function', async function() {
      const { __zigar, setTimes, setLinkTimes } = await importTest('set-times-of-file-by-path-with-posix-function', { useLibc: true });
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
      if (target !== 'wasm32') {
        setLinkTimes('/world/hello.txt', 123, 456);
        expect(event).to.eql({
          parent: null,
          path: 'world/hello.txt',
          times: { atime: 123000025000n, mtime: 456000055000n },
          flags: {}
        });
      }
    })
    it('should set access and last modified time of a file by using utime', async function() {
      const { __zigar, setTimes } = await importTest('set-times-of-file-by-path-with-utime', { useLibc: true });
      let event;
      __zigar.on('set_times', (evt) => {
        event = evt;
        return true;
      });
      setTimes('/world/hello.txt', 123, 456);
      expect(event).to.eql({
        parent: null,
        path: 'world/hello.txt',
        times: { atime: 123000000000n, mtime: 456000000000n },
        flags: { symlinkFollow: true }
      });
      __zigar.on('set_times', (evt) => {
        return false;
      })
      expect(() => setTimes('/world/hello.txt', 123, 456)).to.throw(Error)
        .with.property('message', 'Unable to set times');
    })
    skip.entirely.if(target === 'win32').
    it('should set access and last modified time of a file in directory using posix function', async function() {
      const { __zigar, setTimes } = await importTest('set-times-of-file-at-dir-with-posix-function', { useLibc: true });
      let event;
      const map = new Map();
      __zigar.on('open', (evt) => {
        return map;
      });
      __zigar.on('set_times', (evt) => {
        event = evt;
        return true;
      });
      setTimes(map, 'hello.txt', 123, 456);
      expect(event).to.eql({
        parent: map,
        path: 'hello.txt',
        times: { atime: 123000000025n, mtime: 456000000055n },
        flags: {}
      });
      __zigar.on('set_times', (evt) => {
        return false;
      })
      expect(() => setTimes(map, 'hello.txt', 123, 456)).to.throw(Error)
        .with.property('message', 'Unable to set times');
    })
    it('should get directory entries', async function() {
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
    it('should get directory entries in thread', async function() {
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
        const lines2 = await capture(async () => await print(map2));
        map2.close();
        expect(lines2).to.have.lengthOf(100);
      } finally {
        await shutdown();;
      }
    })
    skip.entirely.if(target === 'win32').
    it('should perform sync operation using posix function', async function() {
      const { __zigar, save } = await importTest('perform-sync-with-posix-function', { useLibc: true });
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
    skip.entirely.unless(target === 'linux').or(target === 'wasm32').
    it('should perform datasync operation using posix function', async function() {
      const { __zigar, save } = await importTest('perform-datasync-with-posix-function', { useLibc: true });
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
    skip.entirely.unless(target === 'linux').or(target === 'wasm32').
    it('should perform advise operation using posix function', async function() {
      const { __zigar, save } = await importTest('perform-advise-with-posix-function', { useLibc: true });
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
      expect(args).to.eql([ 5, 1000, 'random' ]);
    })
    skip.entirely.unless(target === 'linux').or(target === 'wasm32').
    it('should perform allocate operation using posix function', async function() {
      const { __zigar, save } = await importTest('perform-allocate-with-posix-function', { useLibc: true });
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
      expect(args).to.eql([ 0, 1000 ]);
    })
    it('should open file in directory', async function() {
      const { __zigar, print } = await importTest('open-file-at-dir');
      __zigar.on('open', (evt) => {
        const { parent, path } = evt;
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
      const lines = await capture(() => print(map, 'test.txt'));
      expect(lines).to.eql([
        'This is a test and this is only a test',
      ])
    })
    it('should retrieve names of files in directory', async function() {
      const { print } = await importTest('scan-directory');
      const map = new Map([
        [ 'hello.txt', { type: 'file', content: 'Hello world' } ],
        [ 'test.txt', { type: 'file', content: 'This is a test and this is only a test' } ],
        [ 'world', { type: 'directory' } ],
      ]);
      const lines = await capture(() => print(map));
      expect(lines).to.eql([
        'hello.txt (file)',
        'test.txt (file)',
        'world (dir)',
      ]);
    })
    it('should retrieve names of files in directory using posix functions', async function() {
      const { __zigar, print } = await importTest('scan-directory-with-posix-functions', { useLibc: true });
      const map = new Map([
        [ 'hello.txt', { type: 'file', content: 'Hello world' } ],
        [ 'test.txt', { type: 'file', content: 'This is a test and this is only a test' } ],
        [ 'world', { type: 'directory' } ],
      ]);
      let event;
      __zigar.on('open', (evt) => {
        if (evt.path.endsWith('directory')) {
          event = evt;
          return map;
        } else {
          return false;
        }
      });
      const lines = await capture(() => print('/somewhere/directory'));
      if (target === 'win32') {
        expect(lines).to.eql([
          '. (unknown)',
          '.. (unknown)',
          'hello.txt (unknown)',
          'test.txt (unknown)',
          'world (unknown)',
        ]);
      } else {
        expect(lines).to.eql([
          '. (dir)',
          '.. (dir)',
          'hello.txt (file)',
          'test.txt (file)',
          'world (dir)',
        ]);
      }
      if (target === 'wasm32') {
        // not sure but non-blocking is set
        expect(event).to.eql({
          parent: null,
          path: 'somewhere/directory',
          rights: { read: true, readdir: true },
          flags: { symlinkFollow: true, nonblock: true, directory: true }
        });
      } else {
        expect(event).to.eql({
          parent: null,
          path: 'somewhere/directory',
          rights: { read: true, readdir: true },
          flags: { symlinkFollow: true, directory: true }
        });       
      }
    })
    it('should create a directory using posix function', async function() {
      const { __zigar, create } = await importTest('create-directory-with-posix-function', { useLibc: true });
      let event;
      __zigar.on('mkdir', (evt) => {
        event = evt;
        return true;
      });
      create('/hello/world');
      expect(event).to.eql({ parent: null, path: 'hello/world' });
    })
    it('should remove a directory using posix function', async function() {
      const { __zigar, remove } = await importTest('remove-directory-with-posix-function', { useLibc: true });
      let event;
      __zigar.on('rmdir', (evt) => {
        event = evt;
        return true;
      });
      remove('/hello/world');
      expect(event).to.eql({ parent: null, path: 'hello/world' });
    })
    it('should remove a file using posix function', async function() {
      const { __zigar, remove } = await importTest('remove-file-with-posix-function', { useLibc: true });
      let event;
      __zigar.on('unlink', (evt) => {
        event = evt;
        return true;
      });
      remove('/hello/world.txt');
      expect(event).to.eql({ parent: null, path: 'hello/world.txt' });
    })
    skip.entirely.if(target == 'win32').
    it('should open and read from file using pread', async function() {
      const { __zigar, readAt } = await importTest('open-and-read-file-with-pread', { useLibc: true });
      const path = absolute('./data/test.txt');
      const content = await readFile(path);
      __zigar.on('open', (evt) => {
        return content;
      });
      const chunk = readAt('/hello/world', 120n, 16n);
      expect(chunk.string).to.equal('cated to the pro');
    })
    skip.entirely.if(target == 'win32').
    it('should open and read from file using preadv', async function() {
      const { __zigar, readAt } = await importTest('open-and-read-file-with-preadv', { useLibc: true });
      const path = absolute('./data/test.txt');
      const content = await readFile(path);
      __zigar.on('open', (evt) => {
        return content;
      });
      const vectors = [
        new Uint8Array(16),
        new Uint8Array(8),
        new Uint8Array(4),
      ];
      const count = readAt('/hello/world', vectors, 76);
      expect(count).to.equal(28);
      const ta = new TextDecoder();
      const strings = vectors.map(a => ta.decode(a));
      expect(strings).to.eql([ 'a new nation, co', 'nceived ', 'in L' ]);
    })
    skip.entirely.if(target == 'win32').
    it('should open and read from file using readv', async function() {
      const { __zigar, read } = await importTest('open-and-read-file-with-readv', { useLibc: true });
      const path = absolute('./data/test.txt');
      const content = await readFile(path);
      __zigar.on('open', (evt) => {
        return content;
      });
      const vectors = [
        new Uint8Array(16),
        new Uint8Array(8),
        new Uint8Array(4),
      ];
      const count = read('/hello/world', vectors);
      expect(count).to.equal(28);
      const ta = new TextDecoder();
      const strings = vectors.map(a => ta.decode(a));
      expect(strings).to.eql([ 'Four score and s', 'even yea', 'rs a' ]);
    })
    skip.entirely.if(target == 'win32').
    it('should open and write into file using pwrite', async function() {
      const { __zigar, writeAt } = await importTest('open-and-write-file-with-pwrite', { useLibc: true });
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
    skip.entirely.if(target == 'win32').
    it('should open and write into file using pwritev', async function() {
      const { __zigar, writeAt } = await importTest('open-and-write-file-with-pwritev', { useLibc: true });
      const array = new Uint8Array(256);
      __zigar.on('open', (evt) => {
        return array;
      });
      const written = writeAt('/hello/world', [ 'Hello', ' world', '???' ], 120n);
      expect(written).to.equal(14);
      const subarray = array.slice(120, 120 + 14);
      const text = new TextDecoder().decode(subarray);
      expect(text).to.equal('Hello world???');
    })
    skip.entirely.if(target == 'win32').
    it('should open and write into file using writev', async function() {
      const { __zigar, write } = await importTest('open-and-write-file-with-writev', { useLibc: true });
      const array = [];
      __zigar.on('open', (evt) => {
        return array;
      });
      const written = write('/hello/world', [ 'Hello', ' world', '???' ]);
      expect(written).to.equal(14);
      const [ subarray ] = array;
      const text = new TextDecoder().decode(subarray);
      expect(text).to.equal('Hello world???');
    })
    skip.entirely.if(target == 'win32').or.if(target === 'wasm32').
    it('should set lock on file using fcntl', async function() {
      const { lock } = await importTest('set-lock-with-fcntl', { useLibc: true });
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
      expect(file1.lock).to.eql({ type: 1, whence: 0, start: 1234, len: 8000, pid: 123 });
      expect(() => lock(file1)).to.throw(Error).with.property('message').that.equal('Unable to set lock');
      const file2 = {
        read() {},
      };
      expect(() => lock(file2)).to.not.throw();
    })
    skip.entirely.if(target === 'win32').or.if(target === 'wasm32').
    it('should set lock on file', async function() {
      const { lock, unlock } = await importTest('set-lock-on-file', { useLibc: true });
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
      expect(file.lock).to.eql({ type: 1, whence: 0, start: 0, len: 0, pid: 0 });
      const result2 = lock(file);
      expect(result2).to.be.false;
      const result3 = unlock(file);
      expect(result3).to.be.true;
      expect(file.lock).to.be.null;
    })
    skip.entirely.if(target === 'win32').or.if(target === 'wasm32').
    it('should get lock on file using fcntl', async function() {
      const { check } = await importTest('get-lock-with-fcntl', { useLibc: true });
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
    skip.entirely.if(target === 'win32').or.if(target === 'wasm32').
    it('should set lock on file using posix function', async function() {
      const { lock, unlock } = await importTest('set-lock-with-posix-function', { useLibc: true });
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
      expect(file.lock).to.eql({ type: 1, whence: 0, start: 0, len: 0, pid: 0 });
      const result2 = lock(file);
      expect(result2).to.be.false;
      const result3 = unlock(file);
      expect(result3).to.be.true;
      expect(file.lock).to.be.null;
    })
    skip.entirely.if(target === 'win32').or.if(target === 'wasm32').
    it('should set lock on file inside thread', async function() {
      const { spawn, startup, shutdown } = await importTest('set-lock-on-file-in-thread', { multithreaded: true, useLibc: true });
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
        await shutdown();;
      }
    })
    skip.entirely.if(target === 'win32').
    it('should set no-blocking flag of descriptor using fcntl', async function() {
      const { print, startup, shutdown } = await importTest('set-non-blocking-flag-with-fcntl', { multithreaded: true, useLibc: true });
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
        await shutdown();;
      }
      reader.close();
    })
    it('should read lines from file using fgets', async function() {
      const { print, startup, shutdown } = await importTest('read-line-from-file-with-fgets', { multithreaded: true, useLibc: true });
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
        await shutdown();;
      }
      reader.close();
    })
    it('should read lines from stdin using fgets', async function() {
      const { __zigar, print, startup, shutdown } = await importTest('read-line-from-stdin-with-fgets', { multithreaded: true, useLibc: true });
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
        await shutdown();;
      }
      reader.close();
    })
    it('should scan variables from a file using fscanf', async function() {
      // C is needed for this test since varargs handling in Zig is still dodgy
      const { scan } = await importTest('c/scan-file-with-fscanf', { useLibc: true });
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
      const { __zigar, scan } = await importTest('c/scan-stdin-with-scanf', { useLibc: true });
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
    it('should scan variables from a web stream using scanf', async function() {
      // ditto
      const { __zigar, startup, shutdown, scan } = await importTest('c/scan-web-stream-with-scanf', { multithreaded: true, useLibc: true });
      const input = [
        '1 2 3 hello',
        '4 5 6 world',
        '123 456',
      ];      
      const stream = new ReadableStream({
        async pull(controller) {
          await delay(25);
          const text = input.shift();
          if (text) {
            const chunk = new TextEncoder().encode(text + '\n');
            controller.enqueue(chunk);
          } else {
            controller.close();
          }
        }
      });
      const reader = stream.getReader();
      __zigar.redirect(0, reader);
      startup(1);
      try {
        const [ line1 ] = await capture(() => scan());
        expect(line1).to.equal('1 2 3 hello');
        const [ line2 ] = await capture(() => scan());
        expect(line2).to.equal('4 5 6 world');
        const [ line3 ] = await capture(() => scan());
        expect(line3).to.equal('count = 2');
        const [ line4 ] = await capture(() => scan());
        expect(line4).to.be.undefined;
      } finally {
        await shutdown();
      }
    })
    it('should get characters from a file using fgetc', async function() {
      const { print } = await importTest('read-file-content-with-fgetc', { useLibc: true });
      const path = absolute('./data/macbeth.txt');
      const content = await readFile(path);
      const lines = await capture(() => print(content));
      const line = lines.find(s => s.includes('Signifying nothing'));
      expect(line).to.be.a('string');
    })
    it('should get characters from stdin using getchar', async function() {
      const { __zigar, print } = await importTest('read-stdin-with-getchar', { useLibc: true });
      const path = absolute('./data/macbeth.txt');
      const content = await readFile(path);
      __zigar.redirect(0, content);
      const lines = await capture(() => print());
      const line = lines.find(s => s.includes('Signifying nothing'));
      expect(line).to.be.a('string');
    })
    it('should push character into stdin using ungetc', async function() {
      const { __zigar, push, get } = await importTest('push-character-into-stdin-with-ungetc', { useLibc: true });
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
      const { __zigar, open, close, write, writeFlush, writeFlushAll } = await importTest('flush-buffer-with-fflush', { useLibc: true });
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
    skip.entirely.unless(target === 'win32').
    it('should delete file using win32 function', async function() {
      const { __zigar, remove, removeW } = await importTest('delete-file-with-win32-function');
      let event;
      __zigar.on('unlink', (evt) => {
        event = evt;
        return true;
      });
      remove('/hello/world.txt');
      expect(event).to.eql({ 
        parent: null, 
        path: 'hello/world.txt',
      });
      removeW('/cześć/świecie.txt');
      expect(event).to.eql({ 
        parent: null, 
        path: 'cześć/świecie.txt' 
      });
    })
    it('should delete file in directory', async function() {
      const { __zigar, remove } = await importTest('delete-file-at-dir');
      let event;
      __zigar.on('unlink', (evt) => {
        event = evt;
        return true;
      });
      const map = new Map([
        [ 'hello.txt', { type: 'file', content: 'Hello world' } ],
        [ 'test.txt', { type: 'file', content: 'This is a test and this is only a test' } ],
        [ 'world', { type: 'directory' } ],
      ]);
      expect(() => remove(map, 'test.txt')).to.not.throw();
      expect(event).to.eql({
        parent: map,
        path: 'test.txt',
      });
      __zigar.on('unlink', (evt) => {
        return false;
      });
      expect(() => remove(map, 'test.txt')).to.throw();
    });
    skip.entirely.unless(target === 'win32').
    it('should remove directory using win32 function', async function() {
      const { __zigar, remove, removeW } = await importTest('remove-directory-with-win32-function');
      let event;
      __zigar.on('rmdir', (evt) => {
        event = evt;
        return true;
      });
      remove('/hello/world');
      expect(event).to.eql({ 
        parent: null, 
        path: 'hello/world',
      });
      removeW('/cześć/świecie');
      expect(event).to.eql({ 
        parent: null, 
        path: 'cześć/świecie'
      });
    })
    it('should remove directory in directory', async function() {
      const { __zigar, remove } = await importTest('remove-directory-at-dir');
      let event;
      __zigar.on('rmdir', (evt) => {
        event = evt;
        return true;
      });
      const map = new Map([
        [ 'hello.txt', { type: 'file', content: 'Hello world' } ],
        [ 'test.txt', { type: 'file', content: 'This is a test and this is only a test' } ],
        [ 'world', { type: 'directory' } ],
      ]);
      expect(() => remove(map, 'world')).to.not.throw();
      expect(event).to.eql({
        parent: map,
        path: 'world',
      });
      __zigar.on('rmdir', (evt) => {
        return false;
      });
      expect(() => remove(map, 'world')).to.throw();
    });
    skip.entirely.unless(target === 'win32').
    it('should make directory using win32 function', async function() {
      const { __zigar, mkdir, mkdirW } = await importTest('make-directory-with-win32-function');
      let event;
      __zigar.on('mkdir', (evt) => {
        event = evt;
        return true;
      });
      mkdir('/hello/world');
      expect(event).to.eql({ 
        parent: null, 
        path: 'hello/world',
      });
      mkdirW('/cześć/świecie');
      expect(event).to.eql({ 
        parent: null, 
        path: 'cześć/świecie'
      });
    })
    it('should make directory in directory', async function() {
      const { __zigar, add } = await importTest('make-directory-at-dir');
      let event;
      __zigar.on('mkdir', (evt) => {
        event = evt;
        return true;
      });
      const map = new Map([
        [ 'hello.txt', { type: 'file', content: 'Hello world' } ],
        [ 'test.txt', { type: 'file', content: 'This is a test and this is only a test' } ],
        [ 'world', { type: 'directory' } ],
      ]);
      expect(() => add(map, 'cow')).to.not.throw();
      expect(event).to.eql({
        parent: map,
        path: 'cow',
      });
      __zigar.on('mkdir', (evt) => {
        return false;
      });
      expect(() => add(map, 'world')).to.throw();
    });
    skip.entirely.if(target === 'win32').
    it('should read files using poll function', async function() {
      const { __zigar, startup, shutdown, readBoth } = await importTest('open-and-read-files-using-poll', { multithreaded: true, useLibc: true });
      __zigar.on('open', ({ path }) => {
        const m = /file(\d)$/.exec(path);
        if (m) {
          const num = parseInt(m[1]);
          const timeout = (num === 1) ? 30 : 70;
          const input = [
            'hello',
            'world 4 5 6',
            '123 456 789 aaa bbb',
          ];
          const stream = new ReadableStream({
            async pull(controller) {
              await delay(timeout);
              const text = input.shift();
              if (text) {
                const chunk = new TextEncoder().encode(text + '\n');
                controller.enqueue(chunk);
              } else {
                controller.close();
              }
            }
          });
          return stream.getReader();
        } else {
          return false;
        }
      });
      startup(1);
      try {
        const lines = await capture(() => readBoth('/file1', '/file2'));
        expect(lines).to.eql([ 
          'read 6 bytes from file 1',
          'read 12 bytes from file 1',
          'read 6 bytes from file 2',
          'read 20 bytes from file 1',
          'read 12 bytes from file 2',
          'read 20 bytes from file 2',
        ]);
      } finally {
        await shutdown();
      }
    })
    skip.entirely.if(target === 'wasm32').
    it('should redirect io from dynamically linked library', async function() {
      const { __zigar, use } = await importTest('redirect-shared-lib');
      let ext;
      switch (target) {
        case 'win32': ext = 'dll'; break;
        case 'darwin': ext = 'dynlib'; break;
        default: ext = 'so'; break;
      }
      const cpuArchs = {
        arm: 'arm',
        arm64: 'aarch64',
        ia32: 'x86',
        loong64: 'loong64',
        mips: 'mips',
        mipsel: 'mipsel',
        ppc: 'powerpc',
        ppc64: 'powerpc64le',
        s390: undefined,
        riscv64: 'riscv64',
        s390x: 's390x',
        x64: 'x86_64',
      };
      const osTags = {
        aix: 'aix',
        darwin: 'macos',
        freebsd: 'freebsd',
        linux: 'linux-gnu',
        openbsd: 'openbsd',
        sunos: 'solaris',
        win32: 'windows',
      };
      const cpuArch = cpuArchs[arch()];
      const osTag = osTags[platform()];
      __zigar.on('syscall', true);
      const libPath = absolute(`./data/print.${ext}`);
      const zigPath = absolute(`./redirect-shared-lib-target.zig`);
      execSync(`zig build-lib "${zigPath}" -target ${cpuArch}-${osTag} -dynamic -femit-bin="${libPath}"`);
      const [ line ] = await capture(() => use(libPath));
      expect(line).to.equal('Hello world');
    })
    it('should create directory in file system using posix function', async function() {
      const { __zigar, makeDirectory } = await importTest('create-directory-in-file-system-with-posix-function', { useLibc: true });
      const path = absolute(`./data/mkdir_test`);
      try {
        let event;
        __zigar.on('mkdir', (evt) => {
          event = evt;
          return undefined;
        });
        makeDirectory(path);
        expect(event).to.eql({
          parent: null,
          path: path.slice(1), 
        });
      } finally {
        try {
          await rmdir(path, { recursive: true, maxRetries: 10 });
        } catch {}
      }
    })
    it('should remove directory in file system using posix function', async function() {
      const { __zigar, removeDirectory } = await importTest('remove-directory-in-file-system-with-posix-function', { useLibc: true });
      const path = absolute(`./data/rmdir_test`);
      await mkdir(path, { recursive: true });
      try {
        let event;
        __zigar.on('rmdir', (evt) => {
          event = evt;
          return undefined;
        });
        removeDirectory(path);
        expect(event).to.eql({
          parent: null,
          path: path.slice(1), 
        });
      } finally {
        try {
          await rmdir(path, { recursive: true, maxRetries: 10 });
        } catch {}
      }
    })
    it('should remove file in file system using posix function', async function() {
      const { __zigar, removeFile } = await importTest('remove-file-in-file-system-with-posix-function', { useLibc: true });
      const path = absolute(`./data/unlink_test.txt`);
      await writeFile(path, 'Hello world');
      try {
        let event;
        __zigar.on('unlink', (evt) => {
          event = evt;
          return undefined;
        });
        removeFile(path);
        expect(event).to.eql({
          parent: null,
          path: path.slice(1), 
        });
      } finally {
        try {
          await unlink(path);
        } catch {}
      }
    })
    skip.entirely.if(target === 'win32').
    it('should set mtime and atime of file using posix function', async function() {
      const { __zigar, setTimes } = await importTest('set-times-of-file-in-file-system-with-posix-function', { useLibc: true });
      const path = absolute(`./data/settimes_test.txt`);
      await writeFile(path, 'Hello world');
      try {
        let event;
        __zigar.on('set_times', (evt) => {
          event = evt;
          return undefined;
        });
        setTimes(path, 3, 1234);
        expect(event).to.eql({
          parent: null,
          path: path.slice(1),
          times: { atime: 3000001234n, mtime: 3000001234n },
          flags: { symlinkFollow: true }
        });
        const info = await stat(path);
        expect(info.atimeMs).to.equal(3000.001234);
        expect(info.mtimeMs).to.equal(3000.001234);
      } finally {
        try {
          await unlink(path);
        } catch {}
      }
    })
    it('should scan directory in file system file using posix function', async function() {
      const { __zigar, print } = await importTest('scan-directory-in-file-system-with-posix-functions', { useLibc: true });
      const path = absolute(`./data/readdir_test`);
      await mkdir(path, { recursive: true });
      await writeFile(`${path}/file1.txt`, 'Hello world');
      await writeFile(`${path}/file2.txt`, 'Rats live on no evil start');
      try {
        const events = [];
        __zigar.on('open', (evt) => {
          events.push(evt);
          return undefined;
        });
        __zigar.on('stat', (evt) => {
          events.push(evt);
          return undefined;
        })
        const lines = await capture(() => print(path));
        expect(lines).to.contain('. (4096 bytes)');
        expect(lines).to.contain('.. (4096 bytes)');
        expect(lines).to.contain('file1.txt (11 bytes)');
        expect(lines).to.contain('file2.txt (26 bytes)');
        const event1 = {
          parent: null,
          path: `${path}/file1.txt`.slice(1),
          flags: { symlinkFollow: true }
        }
        const found1 = events.find((evt) => evt.path === event1.path);
        expect(found1).to.eql(event1);
        const event2 = {
          parent: null,
          path: `${path}/file2.txt`.slice(1),
          flags: { symlinkFollow: true }
        }
        const found2 = events.find((evt) => evt.path === event2.path);
        expect(found2).to.eql(event2);
        const event3 = {
          parent: null,
          path: path.slice(1),
          flags: { symlinkFollow: true }
        }
        const found3 = events.find((evt) => evt.path === event3.path && !evt.rights);
        expect(found3).to.eql(event3);
      } finally {
        try {
          await rmdir(path, { recursive: true });
        } catch {}
      }
    })
  })
}

function absolute(relPath) {
  return fileURLToPath(new URL(relPath, import.meta.url));
}
