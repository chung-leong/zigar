import { expect } from 'chai';
import 'mocha-skip-if';
import { fileURLToPath } from 'url';

export function addTests(importModule, options) {
  const { target } = options;
  const importTest = async (name, options) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url, options);
  };
  describe('Options', function() {
    this.timeout(0);
    it('should omit functions when option is set', async function() {
      const { default: moduleWO } = await importTest('omit-functions', { omitFunctions: true });
      expect(moduleWO.a).to.be.undefined;
      expect(moduleWO.b).to.be.undefined;
      expect(moduleWO.c).to.be.undefined;
    })
    it('should omit variables when option is set', async function() {
      const { default: moduleWO } = await importTest('omit-variables', { omitVariables: true });
      expect(moduleWO.a).to.be.a('number');
      expect(moduleWO.b).to.be.undefined;
      expect(moduleWO.c).to.be.undefined;
    })
    it('should not attempt io redirection when feature is disabled', async function() {
      const { __zigar, check } = await importTest('disable-redirection', { useRedirection: false });
      if (target === 'wasm32') {
        const { WASI } = await import('wasi');
        __zigar.set('wasi', new WASI({
          version: 'preview1',
          args: [],
          env: {},
          preopens: {
            '/': '/',
          },
        }));
      }
      await __zigar.init();
      const path = fileURLToPath(import.meta.url);
      expect(() => __zigar.on('open', () => {})).to.throw();
      check(path);
    })
  })
}