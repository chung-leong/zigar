import { expect } from 'chai';
import { capture } from '../capture.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Function calling', function() {
    it('should attach functions as getters and setters', async function() {
      this.timeout(120000);
      const { default: module, Hello } = await importTest('attach-getters-setters');
      expect(module.cow).to.equal(123);
      module.cow = 456;
      expect(module.cow).to.equal(456);
      expect(Hello.something).to.equal(100);
      Hello.something = 200;
      expect(Hello.something).to.equal(200);
      const [ line ] = await capture(() => Hello.printSomething());
      expect(line).to.equal('something = 200');
      const object = new Hello({ dog: 3, cat: 7 });
      expect(object.both).to.equal(10);
    })
  })
}