import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Float', function() {
    it('should import float as static variables', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('as-static-variables');
      expect(module.float16_const.toFixed(1)).to.equal('-44.4');
      expect(module.float16.toFixed(2)).to.equal('0.44');
      expect(module.float32_const.toFixed(4)).to.equal('0.1234');
      expect(module.float32.toFixed(2)).to.equal('34567.56');
      expect(module.float64).to.equal(Math.PI);
      expect(module.float80).to.equal(Math.PI);
      expect(module.float128).to.equal(Math.PI);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('3.141592653589793');
      module.float64 = 1.234;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('1.234');
      expect(() => module.float32_const = 0).to.throw();
    })
    it('should print float arguments', async function() {
      this.timeout(120000);
      const { default: module, print1, print2 } = await importTest('as-function-parameters');
      const lines = await capture(() => {
        print1(Math.PI, Math.PI);
        print2(Math.PI, Math.PI, Math.PI);
      });
      expect(lines).to.eql([
        '3.140625 3.1415927410125732',
        '3.141592653589793 3.141592653589793e+00 3.141592653589793e+00',
      ]);
    })
    it('should return float', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('as-return-value');
      expect(module.getFloat16()).to.equal(-44.40625);
      expect(module.getFloat32()).to.equal(0.1234000027179718);
      expect(module.getFloat64()).to.equal(Math.PI);
      expect(module.getFloat80()).to.equal(Math.PI);
      expect(module.getFloat128()).to.equal(Math.PI);
    })
    it('should handle float in array', async function() {
      this.timeout(120000);
      const { default: module, print1, print2, print3 } = await importTest('array-of');
      expect([ ...module.array1 ]).to.eql([ 1.25, 2.25, 3.25, 4.25 ]);
      expect([ ...module.array2 ]).to.eql([ 1.1, 2.1, 3.1, 4.1 ]);
      // TODO: #236
      // expect([ ...module.array3 ]).to.eql([ 1.1, 2.1, 3.1, 4.1 ]);
      const [ before1 ] = await capture(() => print1());
      expect(before1).to.equal('{ 1.25e+00, 2.25e+00, 3.25e+00, 4.25e+00 }');
      module.array1 = [ 3.5, 3.5, 3.5, 3.5 ];
      const [ after1 ] = await capture(() => print1());
      expect(after1).to.equal('{ 3.5e+00, 3.5e+00, 3.5e+00, 3.5e+00 }');
      const [ before2 ] = await capture(() => print2());
      expect(before2).to.equal('{ 1.1e+00, 2.1e+00, 3.1e+00, 4.1e+00 }');
      module.array2 = [ 3.5, 3.5, 3.5, 3.5 ];
      const [ after2 ] = await capture(() => print2());
      expect(after2).to.equal('{ 3.5e+00, 3.5e+00, 3.5e+00, 3.5e+00 }');
      const [ before3 ] = await capture(() => print3());
      expect(before3).to.equal('{ 1.1e+00, 2.1e+00, 3.1e+00, 4.1e+00 }');
      module.array3 = [ 3.5, 3.5, 3.5, 3.5 ];
      const [ after3 ] = await capture(() => print1());
      expect(after3).to.equal('{ 3.5e+00, 3.5e+00, 3.5e+00, 3.5e+00 }');
    })
  })
}