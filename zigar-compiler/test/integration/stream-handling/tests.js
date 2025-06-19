import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { open, readFile } from 'fs/promises';
import 'mocha-skip-if';
import { platform } from 'os';
import { fileURLToPath } from 'url';

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
  })
}

function absolute(relPath) {
  return fileURLToPath(new URL(relPath, import.meta.url));
}
