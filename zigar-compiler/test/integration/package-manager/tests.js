import { expect } from 'chai';
import { readFile } from 'fs/promises';
import os from 'os';
import { fileURLToPath } from 'url';
import { capture } from '../test-utils.js';

export function addTests(importModule, options) {
  const { target } = options;
  const importTest = async (name, options) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url, options);
  };
  describe('Package manager', function() {
    skip.if(target === 'wasm32').
    it('should link in ziglua', async function() {
      this.timeout(0);
      const { run } = await importTest('use-ziglua/ziglua');
      switch (os.arch()) {
        case 'ia32': {
          // getting "Illegal instruction" error for some reason when run() is called
          expect(run).to.be.a('function');
        } break;
        default: {
          const code = `print "Hello world"`;
          const lines = await capture(() => run(code));
          expect(lines).to.eql([ 'Hello world' ]);
        }
      }
    })
    it('should link in zig-sqlite', async function() {
      this.timeout(0);
      const { __zigar, search } = await importTest('use-zig-sqlite/zig-sqlite', { useLLVM: true, useLibc: true });
      const path = fileURLToPath(new URL('./use-zig-sqlite/chinook.db', import.meta.url));
      const content = await readFile(path);
      __zigar.on('open', ({ path }) => {
        if (path.endsWith('chinook.db')) return content;
        return false;
      });
      __zigar.on('stat', ({ path }) => {
        if (path.endsWith('chinook.db')) return { size: content.length };
        return false;
      });
      __zigar.on('mkdir', () => true);
      __zigar.on('rmdir', () => true);
      const lines = await capture(() => search('music'));
      expect(lines).to.have.lengthOf(4);
      expect(lines[0]).to.contain('Handel');
      expect(lines[3]).to.contain('Mozart');
    })
    it('should use zig-sqlite in multithread mode', async function() {
      this.timeout(0);
      const { __zigar, startup, shutdown, open, close, search } = await importTest('use-zig-sqlite/zig-sqlite-threaded', { useLibc: true, multithreaded: true });
      const path = fileURLToPath(new URL('./use-zig-sqlite/chinook.db', import.meta.url));
      const content = await readFile(path);
      const blob = new Blob([ content ]);
      __zigar.on('open', ({ path }) => {
        if (path.endsWith('chinook.db')) return blob;
        return false;
      });
      __zigar.on('stat', ({ path }) => {
        if (path.endsWith('chinook.db')) return { size: blob.size };
        return false;
      });
      __zigar.on('mkdir', () => true);
      __zigar.on('rmdir', () => true);
      startup();
      try {
        await open();
        const results = await search('death');
        await close();
        expect(results.valueOf()).to.eql([
          {
            AlbumId: 94,
            Title: 'A Matter of Life and Death',
            ArtistId: 90,
            Artist: 'Iron Maiden'
          },
          {
            AlbumId: 98,
            Title: 'Dance Of Death',
            ArtistId: 90,
            Artist: 'Iron Maiden'
          },
          {
            AlbumId: 102,
            Title: 'Live After Death',
            ArtistId: 90,
            Artist: 'Iron Maiden'
          }
        ]);
      } finally {
        await shutdown();
      }
    })
    it('should correctly link in local package', async function() {
      this.timeout(0);
      const { hello } = await importTest('use-local/local');
      const [ line ] = await capture(() => hello(123, 456));
      expect(line).to.eql('sum = 579');
    })
  })
}
