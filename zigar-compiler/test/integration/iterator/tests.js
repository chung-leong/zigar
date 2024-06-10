import { expect } from 'chai';

export function addTests(importModule, options) {
  const { target, optimize } = options;
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };
  describe('Iterator', function() {
    it('should get iterator from std.mem.splitSequence', async function() {
      this.timeout(300000);
      const { split } = await importTest('split-iterator');
      const s = 'hello||world||123||chicken';
      const list = [];
      for (const token of split(s, '||')) {
        list.push(token.string);
      }
      expect(list).to.eql([ 'hello', 'world', '123', 'chicken' ]);
    })
  })
}
