import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Bool', function() {
    it('should import bool as static variables', async function() {
      this.timeout(120000);
      const { default: module, bool3, bool4, print } = await importTest('as-static-variables');
      expect(module.bool1).to.be.true;
      expect(module.bool2).to.be.false;
      expect(module.bool3).to.be.true;
      expect(module.bool4).to.be.false;
      expect(bool3).to.be.true;
      expect(bool4).to.be.false;
      const [ before ] = await capture(() => print());
      expect(before).to.equal('yes');
      module.bool1 = false;
      expect(module.bool1).to.be.false;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('no');
    })
    it('should print bool arguments', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('as-function-parameters');
      const lines = await capture(() => {
        print(true);
        print(false);
      });
      expect(lines).to.eql([ 'yes', 'no' ]);
    })
    it('should return bool', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('as-return-value');
      expect(module.getTrue()).to.equal(true);
      expect(module.getFalse()).to.equal(false);
    })
    it('should handle bool in array', async function() {
      this.timeout(120000);
      const { default: module, array_const, print } = await importTest('array-of');      
      expect(module.array.length).to.equal(4);
      expect([ ...module.array ]).to.eql([ true, false, false, true ]);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('{ true, false, false, true }');
      module.array[2] = true;
      const [ after1 ] = await capture(() => print());      
      expect(after1).to.equal('{ true, false, true, true }');
      module.array = [ true, true, true, true ];
      const [ after2 ] = await capture(() => print());      
      expect(after2).to.equal('{ true, true, true, true }');      
      // TODO: #26
      // expect(() => array_const[0] = true).to.throw();
      expect(() => module.array_const = [ false, false, false, false ]).to.throw();
      expect(() => module.array = [ false, false, false ]).to.throw();
    })

  })
}
