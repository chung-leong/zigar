import { expect } from 'chai';

import { StructureType } from '../src/structure.js';
import { MemberType } from '../src/member.js';
import {
  throwNoInitializer,
  throwBufferSizeMismatch,
  throwBufferExpected,
  throwEnumExpected,
  throwErrorExpected,
  throwNotInErrorSet,
  throwInvalidType,
  throwMultipleUnionInitializers,
  throwInactiveUnionProperty,
  throwMissingUnionInitializer,
  throwInvalidInitializer,
  throwInvalidArrayInitializer,
  throwArrayLengthMismatch,
  throwMissingInitializers,
  throwNoProperty,
  throwArgumentCountMismatch,
  rethrowArgumentError,
  throwNoCastingToPointer,
  throwConstantConstraint,
  throwMisplacedSentinel,
  throwMissingSentinel,
  throwAlignmentConflict,
  throwAssigningToConstant,
  throwTypeMismatch,
  throwInaccessiblePointer,
  throwNullPointer,
  throwInvalidPointerTarget,
  throwFixedMemoryTargetRequired,
  throwOverflow,
  throwOutOfBound,
  rethrowRangeError,
  throwNotNull,
  throwNotUndefined,
  decamelizeErrorName,
  throwZigError,
  article,
  formatList,
} from '../src/error.js';

describe('Error functions', function() {
  describe('throwNoInitializer', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Struct,
        byteSize: 8,
      };
      expect(() => throwNoInitializer(structure)).to.throw(TypeError)
        .with.property('message').that.contains('undefined');
    })

  })
  describe('throwBufferSizeMismatch', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Struct,
        byteSize: 8,
      };
      expect(() => throwBufferSizeMismatch(structure, 16)).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
    })
    it('should use different message for shapeless slices', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Slice,
        byteSize: 8,
      };
      expect(() => throwBufferSizeMismatch(structure, 16)).to.throw(TypeError)
        .with.property('message').that.contains('elements');
    })
    it('should not use different message when a slice has been created already', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Slice,
        byteSize: 8,
      };
      expect(() => throwBufferSizeMismatch(structure, 16, { length: 5 })).to.throw(TypeError)
        .with.property('message').that.does.not.contains('elements');
    })
    it('should use singular wording when size is 1', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Slice,
        byteSize: 1,
      };
      expect(() => throwBufferSizeMismatch(structure, 16)).to.throw(TypeError)
        .with.property('message').that.does.not.contains('bytes');
    })
  })
  describe('throwBufferExpected', function() {
    it('should throw a type error', function() {
      const structure1 = {
        name: 'Hello',
        type: StructureType.Struct,
        byteSize: 88,
      };
      expect(() => throwBufferExpected(structure1)).to.throw(TypeError)
        .with.property('message').that.contains('88')
        .and.that.contains('an ArrayBuffer or a DataView');
      const structure2 = {
        name: 'Hello',
        type: StructureType.Struct,
        byteSize: 88,
        typedArray: Uint16Array,
      };
      expect(() => throwBufferExpected(structure2)).to.throw(TypeError)
        .with.property('message').that.contains('88')
        .and.that.contains('an ArrayBuffer, a DataView or an Uint16Array');
    })
    it('should use singular wording when size is 1', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Struct,
        byteSize: 1,
      };
      expect(() => throwBufferExpected(structure)).to.throw(TypeError)
        .with.property('message').that.does.not.contains('bytes');
    })

  })
  describe('throwEnumExpected', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Enumeration,
        byteSize: 8,
      };
      expect(() => throwEnumExpected(structure, {})).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
      expect(() => throwEnumExpected(structure, 16)).to.throw(TypeError)
        .with.property('message').that.contains('16');

    })
  })
  describe('throwErrorExpected', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.ErrorSet,
        byteSize: 8,
      };
      expect(() => throwErrorExpected(structure, {})).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
      expect(() => throwErrorExpected(structure, 1)).to.throw(TypeError)
        .with.property('message').that.contains('1');
      expect(() => throwErrorExpected(structure, 'cow')).to.throw(TypeError)
        .with.property('message').that.contains('cow');

    })
  })
  describe('throwNotInErrorSet', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.ErrorSet,
        byteSize: 8,
      };
      expect(() => throwNotInErrorSet(structure)).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
    })
  })
  describe('throwInvalidType', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Struct,
        byteSize: 8,
      };
      expect(() => throwInvalidType(structure, 16)).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
    })
  })
  describe('throwMultipleUnionInitializers', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.BareUnion,
        byteSize: 8,
      };
      expect(() => throwMultipleUnionInitializers(structure, 16)).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
    })
  })
  describe('throwInvalidArrayInitializer', function() {
    it('should throw an error for primitive array initializers', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Array,
        byteSize: 8,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              byteSize: 4,
            }
          ],
        },
      };
      expect(() => throwInvalidArrayInitializer(structure, {})).to.throw(TypeError)
        .with.property('message').that.contains('number');
    })
    it('should throw an error for enumeration array initializers', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Array,
        byteSize: 8,
        instance: {
          members: [
            {
              type: MemberType.EnumerationItem,
              bitSize: 32,
              byteSize: 4,
            }
          ],
        },
      };
      expect(() => throwInvalidArrayInitializer(structure, {})).to.throw(TypeError)
        .with.property('message').that.contains('enum items');
    })
    it('should throw an error for object array initializers', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Array,
        byteSize: 8,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 32,
              byteSize: 4,
            }
          ],
        },
      };
      expect(() => throwInvalidArrayInitializer(structure, {})).to.throw(TypeError)
        .with.property('message').that.contains('objects');
    })
  })
  describe('throwArrayLengthMismatch', function() {
    it('should throw a type error', function() {
      const elementConstructor = function() {};
      const arrayConstructor = function() {};
      arrayConstructor.child = elementConstructor;
      const structure = {
        name: 'Hello',
        type: StructureType.Array,
        byteSize: 8,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              byteSize: 4,
              structure: {
                constructor: elementConstructor,
              }
            }
          ],
        },
        constructor: arrayConstructor,
      };
      expect(() => throwArrayLengthMismatch(structure, { length: 1 }, { length: 5 })).to.throw(TypeError)
        .with.property('message').that.contains('1 element').and.that.contains('5 initializers');
      expect(() => throwArrayLengthMismatch(structure, { length: 2 }, { length: 1 })).to.throw(TypeError)
        .with.property('message').that.contains('2 elements').and.that.contains('1 initializer');
      expect(() => throwArrayLengthMismatch(structure, { length: 2 }, new elementConstructor())).to.throw(TypeError)
        .with.property('message').that.contains('only a single one');
      const array = new arrayConstructor();
      array.length = 5;
      expect(() => throwArrayLengthMismatch(structure, { length: 2 }, array)).to.throw(TypeError)
        .with.property('message').that.contains('a slice/array that has 5');

    })
  })
  describe('throwInactiveUnionProperty', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.BareUnion,
        byteSize: 8,
        instance: {
          members: [
            { name: 'cat' },
            { name: 'dog' },
          ]
        }
      };
      expect(() => throwInactiveUnionProperty(structure, 'cat', 'dog')).to.throw(TypeError)
        .with.property('message').that.contains('cat');
    })
  })
  describe('throwMissingUnionInitializer', function() {
    it('should throw a type error', function() {
      const structure1 = {
        name: 'Hello',
        type: StructureType.BareUnion,
        byteSize: 8,
        instance: {
          members: [
            { name: 'cat' },
            { name: 'dog' },
          ]
        }
      };
      expect(() => throwMissingUnionInitializer(structure1, {}, false)).to.throw(TypeError)
        .with.property('message').that.contains('cat').and.that.contains('dog');
      const structure2 = {
        name: 'Hello',
        type: StructureType.BareUnion,
        byteSize: 8,
        instance: {
          members: [
            { name: 'cat' },
            { name: 'dog' },
            { name: 'selector' },
          ]
        }
      };
      expect(() => throwMissingUnionInitializer(structure2, {}, true)).to.throw(TypeError)
        .with.property('message').that.does.not.contain('selector');
    })
  })
  describe('throwInvalidInitializer', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.BareUnion,
        byteSize: 8,
      };
      expect(() => throwInvalidInitializer(structure, 'object', 16)).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
    })
  })
  describe('throwMissingInitializers', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.BareUnion,
        byteSize: 8,
        instance: {
          members: [
            { name: 'dog', isRequired: true },
            { name: 'cat', isRequired: false },
          ],
        }
      };
      expect(() => throwMissingInitializers(structure, [ 'dog' ])).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
    })
  })
  describe('throwNoProperty', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.BareUnion,
        byteSize: 8,
      };
      expect(() => throwNoProperty(structure, 'cow')).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
    })
  })
  describe('throwArgumentCountMismatch', function() {
    it('should throw an error', function() {
      const structure1 = {
        name: 'Hello',
        type: StructureType.BareUnion,
        byteSize: 8,
        instance: {
          members: [
            { name: 'dog' },
            { name: 'cat' },
            { name: 'turkey' },
            { name: 'retval' },
          ],
        }
      };
      const structure2 = {
        name: 'Hello',
        type: StructureType.BareUnion,
        byteSize: 8,
        instance: {
          members: [
            { name: 'dog' },
            { name: 'retval' },
          ],
        }
      };
      expect(() => throwArgumentCountMismatch(structure1, 0)).to.throw(Error)
        .with.property('message').that.contains('0').and.contains('3 arguments');
      expect(() => throwArgumentCountMismatch(structure2, 0)).to.throw(Error)
        .with.property('message').that.contains('0').and.contains('1 argument,');
    })
  })
  describe('rethrowArgumentError', function() {
    it('should rethrow an error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.BareUnion,
        byteSize: 8,
        instance: {
          members: [
            { name: '0' },
            { name: '1' },
            { name: '2' },
            { name: 'retval' },
          ],
        }
      };
      const err = new TypeError('Something');
      expect(() => rethrowArgumentError(structure, 0, err)).to.throw(TypeError)
        .with.property('message').that.contains('(args[0], ...)').and.contains(err.message);
      expect(() => rethrowArgumentError(structure, 1, err)).to.throw(TypeError)
        .with.property('message').that.contains('(..., args[1], ...)');
      expect(() => rethrowArgumentError(structure, 2, err)).to.throw(TypeError)
        .with.property('message').that.contains('(..., args[2])');
    })
  })
  describe('throwNoCastingToPointer', function() {
    it('should throw a type error', function() {
      const structure = {
        name: '*Hello',
        type: StructureType.Pointer,
        byteSize: 8,
        instance: {
          members: [],
        },
        hasPointer: true,
      };
      expect(() => throwNoCastingToPointer(structure)).to.throw(TypeError);
    })
  })
  describe('throwConstantConstraint', function() {
    it('should throw a type error', function() {
      const structure = {
        name: '[]const u8',
        type: StructureType.Pointer,
        byteSize: 1,
        instance: {
          members: [],
        },
        hasPointer: true,
      };
      const pointer = {};
      expect(() => throwConstantConstraint(structure, pointer)).to.throw(TypeError);
    })
  })
  describe('throwMisplacedSentinel', function() {
    it('should throw a type error', function() {
      const structure = {
        name: '[_:0]u8',
        type: StructureType.Slice,
        byteSize: 1,
        instance: {
          members: [],
        },
        hasPointer: false,
      };
      expect(() => throwMisplacedSentinel(structure, 0, 5, 8)).to.throw(TypeError);
    })
  })
  describe('throwMissingSentinel', function() {
    it('should throw a type error', function() {
      const structure = {
        name: '[_:0]u8',
        type: StructureType.Slice,
        byteSize: 1,
        instance: {
          members: [],
        },
        hasPointer: false,
      };
      expect(() => throwMissingSentinel(structure, 0, 8)).to.throw(TypeError);
    })
  })
  describe('throwAlignmentConflict', function() {
    it('should throw a type error', function() {
      expect(() => throwAlignmentConflict(4, 3)).to.throw(TypeError)
        .with.property('message').that.contains('4-byte').and.contains('3-byte');
    })
  })
  describe('throwAssigningToConstant', function() {
    it('should throw a type error', function() {
      const pointer = { constructor: { name: 'Hello' }};
      expect(() => throwAssigningToConstant(pointer)).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
    })
  })
  describe('throwTypeMismatch', function() {
    it('should throw a type error', function() {
      expect(() => throwTypeMismatch('string', 8)).to.throw(TypeError)
        .with.property('message').that.contains('a string');
    })
  })
  describe('throwInaccessiblePointer', function() {
    it('should throw a type error', function() {
      expect(() => throwInaccessiblePointer()).to.throw(TypeError);
    })
  })
  describe('throwNullPointer', function() {
    it('should throw a type error', function() {
      expect(() => throwNullPointer()).to.throw(TypeError);
    })
  })
  describe('throwInvalidPointerTarget', function() {
    it('should throw a type error', function() {
      const structure = {
        name: '*Hello',
        type: StructureType.Pointer,
        byteSize: 8,
        instance: {
          members: [],
        },
        hasPointer: true,
      };
      function Bear() {};
      function Antelope() {};
      expect(() => throwInvalidPointerTarget(structure, new Bear())).to.throw(TypeError)
        .with.property('message').that.contains('a Bear object');
      expect(() => throwInvalidPointerTarget(structure, new Antelope())).to.throw(TypeError)
        .with.property('message').that.contains('an Antelope object');
      expect(() => throwInvalidPointerTarget(structure, false)).to.throw(TypeError)
        .with.property('message').that.contains('a boolean');
      expect(() => throwInvalidPointerTarget(structure, {})).to.throw(TypeError)
        .with.property('message').that.contains('an object');
      expect(() => throwInvalidPointerTarget(structure, undefined)).to.throw(TypeError)
        .with.property('message').that.contains('undefined');
    })
  })
  describe('throwFixedMemoryTargetRequired', function() {
    it('should throw a type error', function() {
      const structure = {
        name: '*Hello',
        type: StructureType.Pointer,
        byteSize: 8,
        instance: {
          members: [],
        },
        hasPointer: true,
      };
      expect(() => throwFixedMemoryTargetRequired(structure, null)).to.throw(TypeError);
    })
  })
  describe('throwOverflow', function() {
    it('should throw a type error', function() {
      const member = {
        name: 'hello',
        type: MemberType.Int,
        bitSize: 8,
      };
      expect(() => throwOverflow(member, 1024)).to.throw(TypeError)
        .with.property('message').that.contains('Int8');
    })
  })
  describe('throwOutOfBound', function() {
    it('should throw a range error', function() {
      const member1 = {
        name: 'hello',
        type: MemberType.Int,
        bitSize: 8,
        bitOffset: 0,
      };
      expect(() => throwOutOfBound(member1, 16)).to.throw(RangeError)
        .with.property('message').that.contains('hello');
      const member2 = {
        type: MemberType.Int,
        bitSize: 8,
      };
      expect(() => throwOutOfBound(member2, 16)).to.throw(RangeError)
        .with.property('message').that.contains('array');

    })
  })
  describe('rethrowRangeError', function() {
    it('should throw range error when given a range error', function() {
      const member = {
        name: 'hello',
        type: MemberType.Int,
        bitSize: 8,
      };
      expect(() => rethrowRangeError(member, 5, new RangeError)).to.throw(RangeError);
      expect(() => rethrowRangeError(member, 5, new TypeError)).to.throw(TypeError);
    })
  })
  describe('throwNotNull', function() {
    it('should throw a type error', function() {
      const member = {
        name: 'hello',
        type: MemberType.Int,
        bitSize: 8,
      };
      expect(() => throwNotNull(member)).to.throw(TypeError)
        .with.property('message').that.contains('hello');
    })
  })
  describe('throwNotUndefined', function() {
    it('should throw a type error', function() {
      const member = {
        name: 'hello',
        type: MemberType.Int,
        bitSize: 8,
      };
      expect(() => throwNotUndefined(member)).to.throw(RangeError)
        .with.property('message').that.contains('hello');
    })
  })
  describe('decamelizeErrorName', function() {
    it('should turn error name into readable sentence', function() {
      const name = 'UnableToRetrieveMemoryLocation';
      const result = decamelizeErrorName(name);
      expect(result).to.equal('Unable to retrieve memory location');
    })
    it('should keep acronyms in uppercase', function() {
      const name1 = 'InvalidHTMLEncountered';
      const result1 = decamelizeErrorName(name1);
      expect(result1).to.equal('Invalid HTML encountered');
      const name2 = 'InvalidHTML';
      const result2 = decamelizeErrorName(name2);
      expect(result2).to.equal('Invalid HTML');
      const name3 = 'HTMLIsInvalid';
      const result3 = decamelizeErrorName(name3);
      expect(result3).to.equal('HTML is invalid');
    })
  })
  describe('throwZigError', function() {
    it('should throw error with the correct message', function() {
      expect(() => throwZigError('PantsOnFire')).to.throw()
        .with.property('message').that.equals('Pants on fire');
    })
  })
  describe('article', function() {
    it('should return an when noun starts with a vowel', function() {
      expect(article('apple')).to.equal('an');
      expect(article('[apple]')).to.equal('an');
    })
    it('should return a when noun does not start with a vowel', function() {
      expect(article('banana')).to.equal('a');
      expect(article('[banana]')).to.equal('a');
    })
  })
  describe('formatList', function() {
    it('should correct format a list of three items', function() {
      const list = [ 'apple', 'banana', 'cantaloupe' ];
      expect(formatList(list)).to.equal('apple, banana or cantaloupe');
    })
    it('should correct format a list of two items', function() {
      const list = [ 'apple', 'banana' ];
      expect(formatList(list)).to.equal('apple or banana');
    })
    it('should correct format a list of one item', function() {
      const list = [ 'apple' ];
      expect(formatList(list)).to.equal('apple');
    })
  })
})