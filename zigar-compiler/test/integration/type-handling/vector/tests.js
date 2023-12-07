import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Vector', function() {
    it('should handle vector as static variables', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('as-static-variables');
      expect([ ...module.v1 ]).to.eql([ 1, 2, 3, 4 ]);
      module.v2 = [ 4, 5, 6 ];
      expect([ ...module.v2 ]).to.eql([ 4, 5, 6 ]);
      const lines = await capture(() => module.print());
      expect(lines).to.eql([ '{ 4, 5, 6 }' ]);
    })
  })
}
