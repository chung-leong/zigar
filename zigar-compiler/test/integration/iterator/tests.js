import { expect } from 'chai';

export function addTests(importModule, options) {
  const { target, optimize } = options;
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };
  describe('Iterator', function() {
    it('should handle struct iterator', async function() {
      this.timeout(300000);
      const { getStruct } = await importTest('struct-iterator');
      const list = [];
      for (const token of getStruct()) {
        list.push(token.string);
      }
      expect(list).to.eql([ "apple", "orange", "lemon" ]);
    })
    it('should handle union iterator', async function() {
      this.timeout(300000);
      const { getUnion } = await importTest('union-iterator');
      const list = [];
      for (const token of getUnion()) {
        list.push(token.string);
      }
      expect(list).to.eql([ "apple", "orange", "lemon" ]);
    })
    it('should handle opaque iterator', async function() {
      this.timeout(300000);
      const { getOpaque } = await importTest('opaque-iterator');
      const list = [];
      for (const token of getOpaque()) {
        list.push(token.string);
      }
      expect(list).to.eql([ "orange", "lemon" ]);
    })
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
    it('should get iterator from std.fs.path.ComponentIterator', async function() {
      this.timeout(300000);
      const { parsePath } = await importTest('path-iterator');
      const path = '/home/chicken/porn/naked-chicks.png';
      const list = [];
      for (const part of parsePath(path)) {
        list.push(part.name.string);
      }
      expect(list).to.eql([ 'home', 'chicken', 'porn', 'naked-chicks.png' ]);
    })
  })
}
