import { expect } from 'chai';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Enum literal', function() {
    it('should handle enum literal as static variables', async function() {
      this.timeout(120000);
      const { hello, world } = await importTest('as-static-variables');
      expect(hello).to.equal('hello');
      expect(world.valueOf()).to.eql({
        0: 'Asgard',
        1: 'Midgard',
        2: 'Jotunheim',
        3: 'Svartalfheim',
        4: 'Vanaheim',
        5: 'Muspelheim',
        6: 'Niflheim',
        7: 'Alfheim',
        8: 'Nidavellir',
      });
    })
  })
}

