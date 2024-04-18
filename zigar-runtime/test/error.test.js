import { expect } from 'chai';

import {
  AccessingOpaque,
  AlignmentConflict,
  ArgumentCountMismatch,
  ArrayLengthMismatch,
  AssigningToConstant,
  BufferExpected,
  BufferSizeMismatch,
  ConstantConstraint,
  CreatingOpaque,
  EnumExpected,
  ErrorExpected,
  FixedMemoryTargetRequired,
  InaccessiblePointer,
  InactiveUnionProperty,
  InvalidArrayInitializer,
  InvalidInitializer,
  InvalidPointerTarget,
  InvalidType,
  MisplacedSentinel,
  MissingInitializers,
  MissingSentinel,
  MissingUnionInitializer,
  MultipleUnionInitializers,
  NoCastingToPointer,
  NoInitializer,
  NoProperty,
  NotInErrorSet,
  NotOnByteBoundary,
  NotUndefined,
  NullPointer,
  OutOfBound,
  Overflow,
  TypeMismatch,
  ZigError,
  adjustArgumentError,
  adjustRangeError,
  article,
  deanimalizeErrorName,
  formatList,
} from '../src/error.js';
import { MemberType, StructureType } from '../src/types.js';

describe('Error functions', function() {
  describe('NoInitializer', function() {
    it('should have expected message', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Struct,
        byteSize: 8,
      };
      const err = new NoInitializer(structure);
      expect(err.message).to.contain('undefined');
    })
  })
  describe('BufferSizeMismatch', function() {
    it('should have expected message', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Struct,
        byteSize: 8,
      };
      const err = new BufferSizeMismatch(structure, 16);
      expect(err.message).to.contain('Hello');
    })
    it('should use different message for shapeless slices', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Slice,
        byteSize: 8,
      };
      const err = new BufferSizeMismatch(structure, 16);
      expect(err.message).to.contain('elements');
    })
    it('should not use different message when a slice has been created already', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Slice,
        byteSize: 8,
      };
      const err = new BufferSizeMismatch(structure, 16, { length: 5 });
      expect(err.message).to.not.contain('elements');
    })
    it('should use singular wording when size is 1', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Slice,
        byteSize: 1,
      };
      const err = new BufferSizeMismatch(structure, 16);
      expect(err.message).to.not.contain('bytes');
    })
  })
  describe('BufferExpected', function() {
    it('should have expected message', function() {
      const structure1 = {
        name: 'Hello',
        type: StructureType.Struct,
        byteSize: 88,
      };
      const err1 = new BufferExpected(structure1);
      expect(err1.message).to.contain('88').and.contain('an ArrayBuffer or a DataView');
      const structure2 = {
        name: 'Hello',
        type: StructureType.Struct,
        byteSize: 88,
        typedArray: Uint16Array,
      };
      const err2 = new BufferExpected(structure2);
      expect(err2.message).to.contain('88').and.contain('an ArrayBuffer, a DataView or an Uint16Array');
    })
    it('should use singular wording when size is 1', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Struct,
        byteSize: 1,
      };
      const err = new BufferExpected(structure);
      expect(err.message).to.not.contain('bytes');
    })

  })
  describe('EnumExpected', function() {
    it('should have expected message', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Enumeration,
        byteSize: 8,
      };
      const err1 = new EnumExpected(structure, {});
      expect(err1.message).to.contain('Hello');
      const err2 = new EnumExpected(structure, 16);
      expect(err2.message).to.contain('16');
    })
  })
  describe('ErrorExpected', function() {
    it('should have expected message', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.ErrorSet,
        byteSize: 8,
      };
      const err1 = new ErrorExpected(structure, {});
      expect(err1.message).to.contain('Hello');
      const err2 = new ErrorExpected(structure, 1);
      expect(err2.message).to.contain('1');
      const err3 = new ErrorExpected(structure, 'cow');
      expect(err3.message).to.contain('cow');
    })
  })
  describe('NotInErrorSet', function() {
    it('should have expected message', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.ErrorSet,
        byteSize: 8,
      };
      const err = new NotInErrorSet(structure);
      expect(err.message).to.contain('Hello');
    })
  })
  describe('InvalidType', function() {
    it('should have expected message', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Struct,
        byteSize: 8,
      };
      const err = new InvalidType(structure, 16);
      expect(err.message).to.contain('Hello');
    })
  })
  describe('MultipleUnionInitializers', function() {
    it('should have expected message', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.BareUnion,
        byteSize: 8,
      };
      const err = new MultipleUnionInitializers(structure, 16);
      expect(err.message).to.contain('Hello');
    })
  })
  describe('InvalidArrayInitializer', function() {
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
      const err = new InvalidArrayInitializer(structure, {});
      expect(err.message).to.contain('number');
    })
    it('should throw an error for enumeration array initializers', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Array,
        byteSize: 8,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              byteSize: 4,
              structure: {
                type: StructureType.Enumeration,
              }
            }
          ],
        },
      };
      const err = new InvalidArrayInitializer(structure, {});
      expect(err.message).to.contain('enum items');
    })
    it('should throw an error for error array initializers', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.Array,
        byteSize: 8,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 16,
              byteSize: 4,
              structure: {
                type: StructureType.ErrorSet,
              }
            }
          ],
        },
      };
      const err = new InvalidArrayInitializer(structure, {});
      expect(err.message).to.contain('errors');
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
      const err = new InvalidArrayInitializer(structure, {});
      expect(err.message).to.contain('objects');
    })
  })
  describe('ArrayLengthMismatch', function() {
    it('should have expected message', function() {
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
      const err1 = new ArrayLengthMismatch(structure, { length: 1 }, { length: 5 });
      expect(err1.message).to.contain('5 initializers');
      const err2 = new ArrayLengthMismatch(structure, { length: 2 }, { length: 1 });
      expect(err2.message).to.contain('1 initializer');
      const err3 = new ArrayLengthMismatch(structure, { length: 2 }, new elementConstructor());
      expect(err3.message).to.contain('only a single one');
      const array = new arrayConstructor();
      array.length = 5;
      const err4 = new ArrayLengthMismatch(structure, { length: 2 }, array);
      expect(err4.message).to.contain('a slice/array that has 5');
    })
  })
  describe('InactiveUnionProperty', function() {
    it('should have expected message', function() {
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
      const err = new InactiveUnionProperty(structure, 'cat', 'dog');
      expect(err.message).to.contain('cat');
    })
  })
  describe('MissingUnionInitializer', function() {
    it('should have expected message', function() {
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
      const err1 = new MissingUnionInitializer(structure1, {}, false);
      expect(err1.message).to.contain('cat').and.contain('dog');
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
      const err2 = new MissingUnionInitializer(structure2, {}, true);
      expect(err2.message).to.not.contain('selector');
    })
  })
  describe('InvalidInitializer', function() {
    it('should have expected message', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.BareUnion,
        byteSize: 8,
      };
      const err = new InvalidInitializer(structure, 'object', 16);
      expect(err.message).to.contain('Hello');
    })
  })
  describe('MissingInitializers', function() {
    it('should have expected message', function() {
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
      const err = new MissingInitializers(structure, [ 'dog' ]);
      expect(err.message).to.contain('Hello');
    })
  })
  describe('NoProperty', function() {
    it('should have expected message', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.BareUnion,
        byteSize: 8,
        instance: {
          members: [ { name: 'cat' } ]
        },
      };
      const err = new NoProperty(structure, 'cow');
      expect(err.message).to.contain('Hello');
    })
    it('should indicate field is comptime when member is present', function() {
      const structure = {
        name: 'Hello',
        type: StructureType.BareUnion,
        byteSize: 8,
        instance: {
          members: [ { name: 'cat' } ]
        },
      };
      const err = new NoProperty(structure, 'cat');
      expect(err.message).to.contain('Comptime');
    })
  })
  describe('ArgumentCountMismatch', function() {
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
      const err1 = new ArgumentCountMismatch(structure1, 0);
      expect(err1.message).to.contain('0').and.contain('3 arguments');
      const err2 = new ArgumentCountMismatch(structure2, 0);
      expect(err2.message).to.contain('0').and.contain('1 argument,');
    })
  })
  describe('NoCastingToPointer', function() {
    it('should have expected message', function() {
      const structure = {
        name: '*Hello',
        type: StructureType.Pointer,
        byteSize: 8,
        instance: {
          members: [],
        },
        hasPointer: true,
      };
      const err = new NoCastingToPointer(structure);
      expect(err.message).to.contain('new operator');
    })
  })
  describe('ConstantConstraint', function() {
    it('should have expected message', function() {
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
      const err = new ConstantConstraint(structure, pointer);
      expect(err.message).to.contain('[]const u8');
    })
  })
  describe('MisplacedSentinel', function() {
    it('should have expected message', function() {
      const structure = {
        name: '[_:0]u8',
        type: StructureType.Slice,
        byteSize: 1,
        instance: {
          members: [],
        },
        hasPointer: false,
      };
      const err = new MisplacedSentinel(structure, 0, 5, 8);
      expect(err.message).to.contain('0').and.contain(5).and.contain('8');
    })
  })
  describe('MissingSentinel', function() {
    it('should have expected message', function() {
      const structure = {
        name: '[_:0]u8',
        type: StructureType.Slice,
        byteSize: 1,
        instance: {
          members: [],
        },
        hasPointer: false,
      };
      const err = new MissingSentinel(structure, 0, 8);
      expect(err.message).to.contain('0').and.contain('8');
    })
  })
  describe('AlignmentConflict', function() {
    it('should have expected message', function() {
      const err = new AlignmentConflict(4, 3);
      expect(err.message).to.contain('4-byte').and.contain('3-byte');
    })
  })
  describe('AssigningToConstant', function() {
    it('should have expected message', function() {
      const pointer = { constructor: { name: 'Hello' }};
      const err = new AssigningToConstant(pointer);
      expect(err.message).to.contain('Hello');
    })
  })
  describe('TypeMismatch', function() {
    it('should have expected message', function() {
      const err = new TypeMismatch('string', 8);
      expect(err.message).to.contain('a string');
    })
  })
  describe('InaccessiblePointer', function() {
    it('should have expected message', function() {
      const err = new InaccessiblePointer();
      expect(err.message).to.contain('not accessible');
    })
  })
  describe('NullPointer', function() {
    it('should have expected message', function() {
      const err = new NullPointer();
      expect(err.message).to.contain('Null pointer');
    })
  })
  describe('InvalidPointerTarget', function() {
    it('should have expected message', function() {
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
      const err1 = new InvalidPointerTarget(structure, new Bear());
      expect(err1.message).to.contain('a Bear object');
      const err2 = new InvalidPointerTarget(structure, new Antelope());
      expect(err2.message).to.contain('an Antelope object');
      const err3 = new InvalidPointerTarget(structure, false);
      expect(err3.message).to.contain('a boolean');
      const err4 = new InvalidPointerTarget(structure, {});
      expect(err4.message).to.contain('an object');
      const err5 = new InvalidPointerTarget(structure, undefined);
      expect(err5.message).to.contain('undefined');
    })
  })
  describe('FixedMemoryTargetRequired', function() {
    it('should have expected message', function() {
      const structure = {
        name: '*Hello',
        type: StructureType.Pointer,
        byteSize: 8,
        instance: {
          members: [],
        },
        hasPointer: true,
      };
      const err = new FixedMemoryTargetRequired(structure, null);
      expect(err.message).to.contain('fixed memory');
    })
  })
  describe('Overflow', function() {
    it('should have expected message', function() {
      const member = {
        name: 'hello',
        type: MemberType.Int,
        bitSize: 8,
      };
      const err = new Overflow(member, 1024);
      expect(err.message).to.contain('Int8');
    })
  })
  describe('OutOfBound', function() {
    it('should throw a range error', function() {
      const member1 = {
        name: 'hello',
        type: MemberType.Int,
        bitSize: 8,
        bitOffset: 0,
      };
      const err1 = new OutOfBound(member1, 16);
      expect(err1.message).to.contain('hello');
      const member2 = {
        type: MemberType.Int,
        bitSize: 8,
      };
      const err2 = new OutOfBound(member2, 16);
      expect(err2.message).to.contain('array');
    })
  })
  describe('NotUndefined', function() {
    it('should have expected message', function() {
      const member = {
        name: 'hello',
        type: MemberType.Int,
        bitSize: 8,
      };
      const err = new NotUndefined(member);
      expect(err.message).to.contain('hello');
    })
  })
  describe('NotOnByteBoundary', function() {
    it('should have expected message', function() {
      const member = {
        name: 'hello',
        type: MemberType.Object,
        bitSize: 8,
        bitOffset: 33,
        structure: { name: 'Hello' }
      };
      const err = new NotOnByteBoundary(member);
      expect(err.message).to.contain('hello');
    })
  })
  describe('CreatingOpaque', function() {
    it('should have expected message', function() {
      const structure =  { name: 'Apple' };
      const err = new CreatingOpaque(structure);
      expect(err.message).to.contain('Apple');
    })
  })
  describe('AccessingOpaque', function() {
    it('should have expected message', function() {
      const structure =  { name: 'Apple' };
      const err = new AccessingOpaque(structure);
      expect(err.message).to.contain('Apple');
    })
  })
  describe('ZigError', function() {
    it('should throw error with the correct message', function() {
      const err = new ZigError('PantsOnFire');
      expect(err.message).to.contain('Pants on fire');
    })
  })
  describe('adjustArgumentError', function() {
    it('should add argument number to an error', function() {
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
      const err1 = adjustArgumentError(structure, 0, err);
      expect(err1.message).to.contain('(args[0], ...)').and.contain(err.message);
      const err2 = adjustArgumentError(structure, 1, err);
      expect(err2.message).to.contain('(..., args[1], ...)');
      const err3 = adjustArgumentError(structure, 2, err);
      expect(err3.message).to.contain('(..., args[2])');
    })
  })
  describe('adjustRangeError', function() {
    it('should throw range error when given a range error', function() {
      const member = {
        name: 'hello',
        type: MemberType.Int,
        bitSize: 8,
      };
      const err1 = adjustRangeError(member, 5, new RangeError);
      expect(err1.message).to.contain('hello');
      const err2 = adjustRangeError(member, 5, new TypeError);
      expect(err2).to.be.instanceOf(TypeError);
    })
  })
  describe('deanimalizeErrorName', function() {
    it('should turn error name into readable sentence', function() {
      const name = 'UnableToRetrieveMemoryLocation';
      const result = deanimalizeErrorName(name);
      expect(result).to.equal('Unable to retrieve memory location');
    })
    it('should handle error name in snake_cast', function() {
      const name = 'unable_to_retrieve_memory_location';
      const result = deanimalizeErrorName(name);
      expect(result).to.equal('Unable to retrieve memory location');
    })
    it('should keep acronyms in uppercase', function() {
      const name1 = 'InvalidHTMLEncountered';
      const result1 = deanimalizeErrorName(name1);
      expect(result1).to.equal('Invalid HTML encountered');
      const name2 = 'InvalidHTML';
      const result2 = deanimalizeErrorName(name2);
      expect(result2).to.equal('Invalid HTML');
      const name3 = 'HTMLIsInvalid';
      const result3 = deanimalizeErrorName(name3);
      expect(result3).to.equal('HTML is invalid');
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