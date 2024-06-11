import { expect } from 'chai';
import { fileURLToPath } from 'url';

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
    it('should get iterator from std.zip.Iterator.init', async function() {
      this.timeout(300000);
      const { scanZip } = await importTest('zip-iterator');
      const path = fileURLToPath(new URL('./test-data/test.zip', import.meta.url));
      const list = [];
      for (const entry of scanZip(path)) {
        list.push(entry.valueOf());
      }
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
