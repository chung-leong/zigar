import { expect } from 'chai';
import { capture } from '../capture.js';
import { platform } from 'os';

export function addTests(importModule, options) {
  const importTest = async (name, options) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url, options);
  };
  describe('Console', function() {
    it('should output to development console', async function() {
      this.timeout(120000);
      const { hello } = await importTest('print-with-newline');
      const lines = await capture(() => hello());
      expect(lines).to.eql([ 'Hello world!' ]);
    })
    it('should flush console after function exits', async function() {
      this.timeout(120000);
      const { print } = await importTest('print-no-newline');
      const lines = await capture(() => print())
      expect(lines[0]).to.equal('Hello world');
    })
    it('should capture output from C code', async function() {
      this.timeout(120000);
      const {
        test_printf,
        test_fprintf,
        test_putc,
        test_fputc,
        test_putchar,
        test_fputs,
        test_puts,
        test_fwrite,
        test_write,
        test_perror,
      } = await importTest('print-thru-c', { useLibc: true });
      expect(await capture(() => test_printf())).eql([
        'Hello 1234',
        'Hello Richard Nixon',
      ]);
      expect(await capture(() => test_fprintf())).eql([
        'Hello 1234 3.14',
        'Hello Joe Blow',
      ]);
      expect(await capture(() => test_putc())).eql([ 'H' ]);
      expect(await capture(() => test_fputc())).eql([ 'H' ]);
      expect(await capture(() => test_putchar())).eql([ 'H' ]);
      expect(await capture(() => test_fputs())).eql([ 'Hello world' ]);
      expect(await capture(() => test_puts())).eql([ 'Hello world' ]);
      expect(await capture(() => test_fwrite())).eql([ 'Hello world' ]);
      expect(await capture(() => test_write())).eql([ 'Hello world' ]);
      const errorMsg = (platform() === 'win32')
      ? 'Hello: Permission denied'
      : 'Hello: No such file or directory';
      expect(await capture(() => test_perror())).eql([ errorMsg ]);
    })
  })
}
