import { expect } from 'chai';

import { StructureType } from '../src/structure.js';
import { MemberType } from '../src/member.js';
import {
  throwBufferSizeMismatch,
  throwBufferExpected,
  throwInvalidEnum,
  throwEnumExpected,
  throwNoNewEnum,
  throwNoNewError,
  throwNotInErrorSet,
  throwUnknownErrorNumber,
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
  throwInaccessiblePointer,
  throwInvalidPointerTarget,
  throwOverflow,
  throwOutOfBound,
  rethrowRangeError,
  throwNotNull,
  decamelizeErrorName,
  throwZigError,
} from '../src/error.js';
import { ELEMENT } from '../src/symbol.js';

describe('Error functions', function() {
  describe('throwBufferSizeMismatch', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Struct,
        size: 8,
      };
      expect(() => throwBufferSizeMismatch(structure, 16)).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
    })
    it('should use different message for slices', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Slice,
        size: 8,
      };
      expect(() => throwBufferSizeMismatch(structure, 16)).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
    })
    it('should use singular wording when size is 1', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Slice,
        size: 1,
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
        size: 88,
      };
      expect(() => throwBufferExpected(structure1)).to.throw(TypeError)
        .with.property('message').that.contains('88')
        .and.that.contains('an ArrayBuffer or a DataView');
      const structure2 = {
        name: 'Hello',
        type: StructureType.Struct,
        size: 88,
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
        size: 1,
      };
      expect(() => throwBufferExpected(structure)).to.throw(TypeError)
        .with.property('message').that.does.not.contains('bytes');
    })

  })
  describe('throwInvalidEnum', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Enumeration,
        size: 8,
      };
      expect(() => throwInvalidEnum(structure, 16)).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
    })
  })
  describe('throwEnumExpected', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Enumeration,
        size: 8,
      };
      expect(() => throwEnumExpected(structure, 16)).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
    })
  })
  describe('throwNoNewEnum', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Enumeration,
        size: 8,
      };
      expect(() => throwNoNewEnum(structure, 16)).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
    })
  })
  describe('throwNoNewError', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.ErrorSet,
        size: 8,
      };
      expect(() => throwNoNewError(structure, 16)).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
    })
  })
  describe('throwNotInErrorSet', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.ErrorSet,
        size: 8,
      };
      expect(() => throwNotInErrorSet(structure)).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
    })
  })
  describe('throwUnknownErrorNumber', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.ErrorSet,
        size: 8,
      };
      expect(() => throwUnknownErrorNumber(structure)).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
    })
  })
  describe('throwInvalidType', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Struct,
        size: 8,
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
        size: 8,
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
        size: 8,
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
        size: 8,
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
        size: 8,
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
      arrayConstructor[ELEMENT] = elementConstructor;
      const structure = {
        name: 'Hello',
        type: StructureType.Array,
        size: 8,
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
      expect(() => throwArrayLengthMismatch(structure, { length: 5 })).to.throw(TypeError)
        .with.property('message').that.contains('2 elements').and.that.contains('5 initializers');
      expect(() => throwArrayLengthMismatch(structure, { length: 1 })).to.throw(TypeError)
        .with.property('message').that.contains('2 elements').and.that.contains('1 initializer');
      expect(() => throwArrayLengthMismatch(structure, new elementConstructor())).to.throw(TypeError)
        .with.property('message').that.contains('only a single one');
      const array = new arrayConstructor();
      array.length = 5;
      expect(() => throwArrayLengthMismatch(structure, array)).to.throw(TypeError)
        .with.property('message').that.contains('a slice/array that has 5');

    })
    it('should use singular noun when there is just one element', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Array,
        size: 4,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              byteSize: 4,
              structure: {
                constructor: function() {},
              }
            }
          ],
        },
        constructor: function() {},
      };
      expect(() => throwArrayLengthMismatch(structure, [])).to.throw(TypeError)
        .with.property('message').that.contains('1 element,');
    })
  })
  describe('throwInactiveUnionProperty', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.BareUnion,
        size: 8,
        instance: {
          members: [
            { name: 'cat' },
            { name: 'dog' },
          ]
        }
      };
      expect(() => throwInactiveUnionProperty(structure, 0, 1)).to.throw(TypeError)
        .with.property('message').that.contains('cat');
    })
  })
  describe('throwMissingUnionInitializer', function() {
    it('should throw a type error', function() {
      const structure1 = {
        name: 'Hello',
        type: StructureType.BareUnion,
        size: 8,
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
        size: 8,
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
        size: 8,
      };
      expect(() => throwInvalidInitializer(structure, 'an object', 16)).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
    })
  })
  describe('throwMissingInitializers', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.BareUnion,
        size: 8,
        instance: {
          members: [
            { name: 'dog', isRequired: true },
            { name: 'cat', isRequired: false },
          ],
        }
      };
      expect(() => throwMissingInitializers(structure, {})).to.throw(TypeError)
        .with.property('message').that.contains('Hello');
    })
  })
  describe('throwNoProperty', function() {
    it('should throw a type error', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.BareUnion,
        size: 8,
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
        size: 8,
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
        size: 8,
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
        size: 8,
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
        size: 8,
        instance: {
          members: [],
        },
        hasPointer: true,
      };
      expect(() => throwNoCastingToPointer(structure)).to.throw(TypeError);
    })
  })
  describe('throwInaccessiblePointer', function() {
    it('should throw a type error', function() {
      expect(() => throwInaccessiblePointer()).to.throw(TypeError);
    })
  })
  describe('throwInvalidPointerTarget', function() {
    it('should throw a type error', function() {
      const structure = {
        name: '*Hello',
        type: StructureType.Pointer,
        size: 8,
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
  describe('throwOverflow', function() {
    it('should throw a type error', function() {
      const member = {
        name: 'hello',
        type: MemberType.Int,
        isSigned: true,
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
        isSigned: true,
        bitSize: 8,
        bitOffset: 0,
      };
      expect(() => throwOutOfBound(member1, 16)).to.throw(RangeError)
        .with.property('message').that.contains('hello');
      const member2 = {
        type: MemberType.Int,
        isSigned: true,
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
        isSigned: true,
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
        isSigned: true,
        bitSize: 8,
      };
      expect(() => throwNotNull(member)).to.throw(RangeError)
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
})