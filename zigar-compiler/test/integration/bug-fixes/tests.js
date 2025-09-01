import { expect } from 'chai';
import { capture } from '../test-utils.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
    const url = new URL(`./${name}.zig`, import.meta.url).href;
    return importModule(url);
  };
  describe('Bug fixes', function() {
    it('should fix issue 689', async function() {
      this.timeout(0);
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
  })
}
