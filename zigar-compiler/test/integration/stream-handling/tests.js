import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { open } from 'fs/promises';
import 'mocha-skip-if';
import { capture, delay } from '../test-utils.js';
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
        output,
      } = await importTest('read-from-reader', { multithreaded: true });
      startup(1);
      try {
        const fd = await open(absolute('./data/test.txt'));
        const stream = fd.readableWebStream();
        const lines = await capture (() => output(stream));
        fd.close();
        expect(lines[0]).to.contain('Four score and seven years');
        expect(lines[4]).to.contain('shall not perish');
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
        const len = await save('This is a test', stream);
        fd.close();
        expect(len).to.equal(14);
      } finally {
        await shutdown();
      }
    })
  })
}

function absolute(relPath) {
  return fileURLToPath(new URL(relPath, import.meta.url));
}
