import { expect } from 'chai';
import { MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { SLOTS } from '../../src/symbols.js';
import { defineProperties } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Member: object', function() {
  describe('defineMemberObject', function() {
    it('should return descriptor for object', function() {
      const env = new Env();
      const member = {
        type: MemberType.Object,
        slot: 1,
        structure: {
          type: StructureType.Struct,
        },
      };
      const { get, set } = env.defineMemberObject(member);
      const struct = defineProperties({
        value: 1,
      }, {
        $: {
          set(arg) {
            Object.assign(this, arg);
          }
        }
      });
      const object = {
        [SLOTS]: {
          1: struct,
        }
      };
      expect(get.call(object)).to.equal(struct);
      set.call(object, { value: 2 });
      expect(struct.value).to.equal(2);
    })
    it('should return descriptor for object containing value', function() {
      const env = new Env();
      const member = {
        type: MemberType.Object,
        slot: 1,
        structure: {
          type: StructureType.Struct,
          flags: StructureFlag.HasValue,
        },
      };
      const { get, set } = env.defineMemberObject(member);
      const struct = defineProperties({}, {
        $: {
          get() {
            return 1;
          },
        }
      });
      const object = {
        [SLOTS]: {
          1: struct,
        }
      };
      expect(get.call(object)).to.equal(1);
    })
    it('should be invokable through defineMember', function() {
      const env = new Env();
      const member = {
        type: MemberType.Object,
        slot: 1,
        structure: {
          type: StructureType.Primitive,
        },
      };
      env.defineMember(member);
      expect(() => env.defineMember(member)).to.not.throw();
    })
  })
})

