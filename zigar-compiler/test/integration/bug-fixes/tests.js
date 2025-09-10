import { expect } from 'chai';
import { capture } from '../test-utils.js';

export function addTests(importModule, options) {
  const importTest = async (name, options) => {
    const url = new URL(`./${name}.zig`, import.meta.url).href;
    return importModule(url, options);
  };
  describe('Bug fixes', function() {
    this.timeout(0);
    it('should fix issue 689', async function() {
      const { hello } = await importTest('issue-689');
      const [ line ] = await capture(() => {
        hello({
            linear: {
                stops: [ 1, 2, 3 ],
            }
        });
      })
      expect(line).to.contain('.stops = { 1, 2, 3 }')
    })
    it('should fix issue 697', async function() {
      const { Callback, runCallback, setCallback } = await importTest('issue-697', { topLevelAwait: false });
      function hello(number, text) {
          console.log(`number = ${number}, text = ${text.string}`);
      }
      const callback = new Callback(hello);
      await setCallback(callback);
      const [ line ] = await capture(() => runCallback());
      setCallback(null);
      expect(line).to.equal('number = 123, text = Hello world');
    })
  })
}
