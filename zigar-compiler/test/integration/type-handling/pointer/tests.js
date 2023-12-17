import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Pointer', function() {
    it('should import pointer as static variables', async function() {
      this.timeout(120000);   
      const { 
        default: module, 
        int32_slice, 
        u8_slice, 
        print,
        printText,
        allocText,
        freeText,
        u8_slice_w_sentinel,
        i64_slice_w_sentinel,
      } = await importTest('as-static-variables');
      expect([ ...module.int32_array ]).to.eql([ 123, 456, 789 ]);
      expect([ ...int32_slice ]).to.eql([ 123, 456, 789 ]);
      expect(module.int32_slice).to.be.an('[]const i32');
      expect(module.int32_slice.get(0)).to.equal(123);
      expect([ ...module.int32_slice ]).to.eql([ 123, 456, 789 ]);
      expect(() => module.int32_slice[0] = 1).to.throw(TypeError);
      const slice = module.int32_slice['*'];
      expect(() => slice.$ = [ 1, 2, 3 ]).to.throw(TypeError);
      expect(() => slice[0] = 1).to.throw(TypeError);
      expect(module.u8_slice).to.have.lengthOf(11);
      expect(u8_slice).to.have.lengthOf(11);
      expect(module.u8_slice.get(0)).to.equal('H'.charCodeAt(0));
      expect([ ...module.uint32_array4 ]).to.eql([ 1, 2, 3, 4 ]);
      expect([ ...module.uint32_slice ]).to.eql([ 2, 3, 4 ]);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('{ 1, 2, 3, 4 }');
      module.uint32_slice.set(1, 777);
      expect([ ...module.uint32_slice ]).to.eql([ 2, 777, 4 ]);
      expect([ ...module.uint32_array4 ]).to.eql([ 1, 2, 777, 4 ]);
      const [ after ] = await capture(() => print());
      expect(after).to.equal('{ 1, 2, 777, 4 }');
      // this shouln't work
      expect(() => module.text = "This is a test").to.throw(TypeError);
      const lines = await capture(() => {
        printText();
        // allocate fixed memory
        const text = allocText("This is a test");
        module.text = text;
        printText();
        module.text = module.alt_text;
        printText();
        freeText(text);
      });
      expect(lines).to.eql([
        'Hello world',
        'This is a test',
        'Goodbye cruel world',
      ]);
      const { string } = u8_slice_w_sentinel;
      expect(string).to.equal('Hello world');
      expect([ ...i64_slice_w_sentinel ]).to.eql([ 0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n ]);
    })
  })
}