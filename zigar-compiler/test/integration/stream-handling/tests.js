import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { open } from 'fs/promises';
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
        const fd = await open(absolute('./data/test.txt'));
        const stream = fd.readableWebStream();
        const digest = await hash(stream.getReader());
        const correct = (platform() === 'win32') 
        ? '8b25078fffd077f119a53a0121a560b3eba816a0' 
        : 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
        expect(digest.string).to.equal(correct);
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
        const len = await save('This is a test', stream.getWriter());
        fd.close();
        expect(len).to.equal(14);
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
        const input = await open(absolute('./data/test.txt.xz'));
        const inStream = input.readableWebStream();
        const reader = inStream.getReader();
        const output = await open(absolute('./data/decompressed.txt'), 'w');
        const outStream = new WritableStream(output);
        const writer = outStream.getWriter();
        await decompress(reader, writer);
        input.close();
        output.close();
      } finally {
        await shutdown();
      }
    })
  })
}

function absolute(relPath) {
  return fileURLToPath(new URL(relPath, import.meta.url));
}
