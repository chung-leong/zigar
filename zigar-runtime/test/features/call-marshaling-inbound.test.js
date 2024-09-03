import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import { MemberType, StructureType } from '../../src/constants.js';
import CallMarshalingInbound, {
  isNeededByStructure,
} from '../../src/features/call-marshaling-inbound.js';

const Env = defineClass('FeatureTest', [ CallMarshalingInbound ]);

describe('Feature: call-marshaling-outbound', function() {
  describe('isNeededByStructure', function() {
    it('should return true when structure is a function pointer', function() {
      const structure = {
        type: StructureType.Pointer,
        instance: {
          members: [
            {
              type: MemberType.Object,
              structure: {
                type: StructureType.Function,
              }
            }
          ]
        }
      };
      expect(isNeededByStructure(structure)).to.be.true;
    })
    it('should return false when structure is not a function pointer', function() {
      const structure = {
        type: StructureType.Function,
        instance: {}
      };
      expect(isNeededByStructure(structure)).to.be.false;
    })
  })
})