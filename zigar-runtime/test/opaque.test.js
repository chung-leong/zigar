import { expect } from 'chai';

import { useAllExtendedTypes } from '../src/data-view.js';
import { NodeEnvironment } from '../src/environment-node.js';
import { useAllMemberTypes } from '../src/member.js';
import { useAllStructureTypes } from '../src/structure.js';
import { ENVIRONMENT } from '../src/symbol.js';
import { StructureType } from '../src/types.js';

describe('Opaque functions', function() {
  const env = new NodeEnvironment();
  describe('defineOpaque', function() {
    beforeEach(function() {
      useAllMemberTypes();
      useAllStructureTypes();
      useAllExtendedTypes();
    })
    it('should define an opaque structure', function() {
      const structure = env.beginStructure({
        type: StructureType.Opaque,
        name: 'Hello',
        byteSize: 0,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(Hello).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(0));
      const object = Hello.call(ENVIRONMENT, dv);
      expect(String(object)).to.equal('[opaque Hello]');
      expect(Number(object)).to.be.NaN;
      expect(object.valueOf()).to.eql({});
      expect(JSON.stringify(object)).to.equal('{}');
      expect(() => object.$).to.throw(TypeError);
      expect(() => new Hello(undefined)).to.throw(TypeError);
    })
    it('should not allow the creation of opaque instances', function() {
      const structure = env.beginStructure({
        type: StructureType.Opaque,
        name: 'Hello',
        byteSize: 0,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(() => new Hello()).to.throw(TypeError);
    })
  })
})