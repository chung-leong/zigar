import { expect } from 'chai';
import 'mocha-skip-if';
import { captureError } from '../test-utils.js';

export function addTests(importModule, options) {
  const { target, optimize } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  const importTest = async (name) => {
    const url = new URL(`./${name}.zig`, import.meta.url).href;
    return importModule(url);
  };
  describe('Error handling', function() {
    it('should attach error stack to error object', async function () {
      this.timeout(0);
      const { throwError } = await importTest('throw-error');
      try {
        throwError();
      } catch (err) {
        const { stack } = err;
        expect(stack).to.be.a('string');
        const lines = stack.split('\n');
        expect(lines[1]).to.contain('throwError');
        expect(lines[2]).to.contain('tests.js');
      }
    });
    skip.permanently.unless(target === 'wasm32').and(runtimeSafety).
    it('should produce an error return trace', async function() {
      this.timeout(0);
      const { fail } = await importTest('wasm-error-trace');
      const [ line ] = await captureError(() => {
        if (runtimeSafety) {
          expect(fail).to.throw(WebAssembly.RuntimeError)
            .with.property('stack')
              .that.contains('error-trace.fail')
              .and.contains('error-trace.a')
              .and.contains('error-trace.b')
              .and.contains('error-trace.c')
              .and.contains('error-trace.d');
        } else {
          expect(fail).to.not.throw();
        }
      });
      expect(line).to.equal('Zig panic: reached unreachable code');
    })
  })
}
