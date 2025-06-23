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
      expect(event).to.eql({ path: '/hello/world', mode: 'readOnly', flags: {} });
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
      expect(event).to.eql({ path: '/hello/world', mode: 'writeOnly', flags: { create: true, truncate: true } });
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
    it('should print stats of file referenced by path', async function() {
      this.timeout(0);
      const { __zigar, print, show } = await importTest('stat-file-by-path');
      const path = '/hello.txt';
      let received;
      __zigar.on('stat', (evt) => {
        received = evt;
        return {
          size: 34,
          ctime: 1234,
          mtime: 4567,
          atime: 9999,
        }
      });
      const lines1 = await capture(() => print(path));
      expect(received).to.eql({ path: '/hello.txt', flags: { symlinkFollow: true } });
      expect(lines1).to.eql([
        'size = 34',
        'ctime = 1234',
        'mtime = 4567',
        'atime = 9999',
      ]);
      __zigar.on('stat', () => false);
      const lines2 = await capture(() => print(path));
      expect(lines2).to.eql([ 'error = error.AccessDenied' ])
      __zigar.on('stat', () => {
        throw new Error('Doh!');
      });
      const [ error ] = await captureError(async () => {
        const lines3 = await capture(() => print(path));
      });
      expect(error).to.equal('Error: Doh!');
      show();
    })
  })
}

function absolute(relPath) {
  return fileURLToPath(new URL(relPath, import.meta.url));
}
