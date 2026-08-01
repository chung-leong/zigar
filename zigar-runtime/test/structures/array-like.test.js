import { expect } from 'chai';
import { ArrayFlag, SliceFlag, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Structure: array-like', function() {
  describe('hasStringProperty', function() {
    it('should return true when structure is an array that can be a string', function() {
      const env = new Env;
      const result = env.hasStringProperty({
        type: StructureType.Array,
        flags: ArrayFlag.IsString,
      });
      expect(result).to.be.true;
    })
    it('should return true when structure is a slice that can be a string', function() {
      const env = new Env;
      const result = env.hasStringProperty({
        type: StructureType.Slice,
        flags: SliceFlag.IsString,
      });
      expect(result).to.be.true;
    })
  })
})
