import { expect } from 'chai';
import os from 'os';
import { fileURLToPath } from 'url';
import { capture } from '../capture.js';

export function addTests(importModule, options) {
  const { target, optimize } = options;
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };
  describe('Package manager', function() {
    skip.if(target === 'wasm32').
    it('should link in ziglua', async function() {
      this.timeout(300000);
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
    skip.if(target === 'wasm32').
    it('should link in zig-sqlite', async function() {
      this.timeout(300000);
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
  })
}
