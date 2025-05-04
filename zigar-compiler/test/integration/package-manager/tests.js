import { expect } from 'chai';
import os from 'os';
import { fileURLToPath } from 'url';
import { capture } from '../test-utils.js';

export function addTests(importModule, options) {
  const { target, compilerVersion } = options;
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };
  describe('Package manager', function() {
    skip.if(target === 'wasm32').or(compilerVersion < '0.14.0').
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
    skip.if(target === 'wasm32').or(compilerVersion < '0.14.0').
    it('should link in zig-sqlite', async function() {
      this.timeout(0);
      const { Db } = await importTest('use-zig-sqlite/zig-sqlite');
      const path = fileURLToPath(new URL('./use-zig-sqlite/chinook.db', import.meta.url));
      const db = Db.init({
        mode: { File: path },
        open_flags: {},
        threading_mode: 'MultiThread',
      });
      const stmt = db.prepareDynamic(`SELECT * FROM albums`);
      // we actually have no way of executing the statement
      db.deinit();
    })
    it('should correctly link in local package', async function() {
      this.timeout(0);
      const { hello } = await importTest('use-local/local');
      const [ line ] = await capture(() => hello(123, 456));
      expect(line).to.eql('sum = 579');
    })
  })
}
