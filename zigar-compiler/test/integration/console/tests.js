import { expect } from 'chai';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Console', function() {
    it('should output to development console', async function() {
      this.timeout(120000);
      const { hello } = await importTest('console');
      const lines = await capture(() => hello());
      expect(lines).to.eql([ 'Hello world!' ]);
    })
    it('should flush console after function exits', async function() {
      this.timeout(120000);
      const { print } = await importTest('print-no-newline.zig');
      const lines = await capture(() => print())
      expect(lines[0]).to.equal('Hello world');
    })
  })
}

async function capture(cb) {
  const logFn = console.log;
  const lines = [];
  try {
    console.log = (text) => {
      if (typeof(text) === 'string') {
        for (const line of text.split(/\r?\n/)) {
          lines.push(line)
        }
      } else {
        logFn.call(console, text);
      }
    };
    await cb();
  } finally {
    console.log = logFn;
  }
  return lines;
}