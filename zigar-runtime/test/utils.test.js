import { expect } from 'chai';

import { MemberType, PosixError } from '../src/constants.js';
import { InvalidFileDescriptor } from '../src/errors.js';
import { LENGTH, MEMORY, PROXY } from '../src/symbols.js';
import {
  adjustAddress,
  alignForward,
  always,
  decodeBase64,
  decodeText,
  defineProperties,
  empty,
  encodeBase64,
  encodeText,
  findSortedIndex,
  getLength,
  getPrimitiveName,
  getProxy,
  getSelf,
  isInvalidAddress,
  isMisaligned,
  never,
  ObjectCache,
  showPosixError,
  toString,
  transformIterable,
  usize,
} from '../src/utils.js';

describe('Utility functions', function() {
  describe('decodeText', function() {
    it('should convert a Uint8Array into a string', function() {
      const text = 'Hello world!';
      const ta = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        ta[i] = text.charCodeAt(i);
      }
      const result = decodeText(ta, 'utf-8');
      expect(result).to.equal(text);
    })
    it('should convert a Uint16Array into a string', function() {
      const text = 'Cześć świecie!';
      const ta = new Uint16Array(text.length);
      for (let i = 0; i < text.length; i++) {
        ta[i] = text.charCodeAt(i);
      }
      const result = decodeText(ta, 'utf-16');
      expect(result).to.equal(text);
    })
    it('should convert an array of Uint16Arrays into a string', function() {
      const text = 'Cześć świecie!';
      const ta1 = new Uint16Array(text.length);
      const ta2 = new Uint16Array(text.length);
      const ta3 = new Uint16Array(text.length);
      for (let i = 0; i < text.length; i++) {
        ta1[i] = text.charCodeAt(i);
        ta2[i] = text.charCodeAt(i);
        ta3[i] = text.charCodeAt(i);
      }
      const result = decodeText([ ta1, ta2, ta3 ], 'utf-16');
      expect(result).to.equal(text.repeat(3));
    })
    it('should convert an array Uint8Array into a string', function() {
      const text = 'Hello world!';
      const ta1 = new Uint16Array(text.length);
      for (let i = 0; i < text.length; i++) {
        ta1[i] = text.charCodeAt(i);
      }
      const result = decodeText([ ta1 ], 'utf-16');
      expect(result).to.equal(text.repeat(1));
    })
  })
  describe('encodeText', function() {
    it('should convert a string to Uint8Array', function() {
      const text = 'Hello world!';
      const ta = encodeText(text, 'utf-8');
      for (const [ index, c ] of ta.entries()) {
        expect(c).to.equal(text.charCodeAt(index));
      }
    })
    it('should convert a string to Uint16Array', function() {
      const text = 'Cześć świecie!';
      const ta = encodeText(text, 'utf-16');
      for (const [ index, c ] of ta.entries()) {
        expect(c).to.equal(text.charCodeAt(index));
      }
    })
  })
  describe('encodeBase64', function() {
    it('should encode data view to base64 string', function() {
      const dv = new DataView(new ArrayBuffer(5));
      for (let i = 0; i < dv.byteLength; i++) {
        dv.setUint8(i, i);
      }
      const s = encodeBase64(dv);
      expect(s).to.equal('AAECAwQ=');
    })
    it('should use browser function to encode data into base64', function() {
      const buffer = global.Buffer;
      global.Buffer = 'removed';
      try {
        const dv = new DataView(new ArrayBuffer(5));
        for (let i = 0; i < dv.byteLength; i++) {
          dv.setUint8(i, i);
        }
        const s = encodeBase64(dv);
        expect(s).to.equal('AAECAwQ=');
      } finally {
        global.Buffer = buffer;
      }
    })
  })
  describe('decodeBase64', function() {
    it('should decode base64 string', function() {
      const s = 'AAECAwQ=';
      const dv = decodeBase64(s);
      for (let i = 0; i < dv.byteLength; i++) {
        expect(dv.getUint8(i)).to.equal(i);
      }
    })
    it('should use browser function to decode base64', function() {
      const buffer = global.Buffer;
      global.Buffer = 'removed';
      try {
        const s = 'AAECAwQ=';
        const dv = decodeBase64(s);
        for (let i = 0; i < dv.byteLength; i++) {
          expect(dv.getUint8(i)).to.equal(i);
        }
      } finally {
        global.Buffer = buffer;
      }
    })
  })
  describe('findSortedIndex', function() {
    it('should return correct indices for the addresses given', function() {
      const list = [
        { address: 10 },
        { address: 20 },
        { address: 30 },
      ];
      expect(findSortedIndex(list, 5, m => m.address)).to.equal(0);
      expect(findSortedIndex(list, 15, m => m.address)).to.equal(1);
      expect(findSortedIndex(list, 25, m => m.address)).to.equal(2);
      expect(findSortedIndex(list, 35, m => m.address)).to.equal(3);
      expect(findSortedIndex(list, 30, m => m.address)).to.equal(3);
      expect(findSortedIndex(list, 10, m => m.address)).to.equal(1);
    })
  })
  describe('transformIterable', function() {
    it('should return array as is when given one', function() {
      const array = [];
      const result = transformIterable(array);
      expect(result).to.equal(array);
    })
    it('should return items from generator in an array', function() {
      const generate = function*() {
        for (let i = 0; i < 5; i++) {
          yield i;
        }
      };
      const result = transformIterable(generate());
      expect(result).to.be.an('array');
      expect(result).to.eql([ 0, 1, 2, 3, 4 ]);
    })
    it('should return new generator with length', function() {
      const generate = function*() {
        yield { length: 5 };
        for (let i = 0; i < 5; i++) {
          yield i;
        }
      };
      const result = transformIterable(generate());
      expect(result).to.not.be.an('array');
      expect(result).to.be.a('generator');
      expect(result).to.have.lengthOf(5);
      expect([ ...result ]).to.eql([ 0, 1, 2, 3, 4 ]);
    })
  })
  describe('defineProperties', function() {
    it('should define properties on an object', function() {
      const object = {};
      defineProperties(object, {
        hello: { value: 5 },
        world: { get: () => 6 },
        universe: false,
      });
      expect(object.hello).to.equal(5);
      expect(object.world).to.equal(6);
      expect(object).to.not.have.property('universe');
    })
  })
  describe('ObjectCache', function() {
    describe('save/find', function() {
      it('should save object to cache', function() {
        const cache = new ObjectCache();
        const dv = new DataView(new ArrayBuffer(4));
        expect(cache.find(dv)).to.be.undefined;
        const object = { [MEMORY]: dv };
        cache.save(dv, object);
        expect(cache.find(dv)).to.equal(object);
        const dv2 = new DataView(new ArrayBuffer(8));
        expect(cache.find(dv2)).to.be.undefined;
      })
    })
  })
  describe('getPrimitiveName', function() {
    it('should return "number" when int is 32-bit or less', function() {
      const member = { type: MemberType.Int, bitSize: 32 };
      expect(getPrimitiveName(member)).to.equal('number');
    })
    it('should return "number" when uint is 32-bit or less', function() {
      const member = { type: MemberType.Uint, bitSize: 32 };
      expect(getPrimitiveName(member)).to.equal('number');
    })
    it('should return "bigint" when int is larger than 32-bit', function() {
      const member = { type: MemberType.Int, bitSize: 34 };
      expect(getPrimitiveName(member)).to.equal('bigint');
    })
    it('should return "bigint" when uint is larger than 32-bit', function() {
      const member = { type: MemberType.Uint, bitSize: 64 };
      expect(getPrimitiveName(member)).to.equal('bigint');
    })
    it('should return "number" for float', function() {
      const member = { type: MemberType.Float, bitSize: 32 };
      expect(getPrimitiveName(member)).to.equal('number');
    })
    it('should return "boolean" for bool', function() {
      const member = { type: MemberType.Bool, bitSize: 32 };
      expect(getPrimitiveName(member)).to.equal('boolean');
    })
    it('should return undefined for other types', function() {
      const member = { type: MemberType.Object, bitSize: 32 };
      expect(getPrimitiveName(member)).to.be.undefined;
    })
  })
  describe('alignForward', function() {
    if (process.env.BITS === '64') {
      it('should create an aligned address from one that is not aligned', function() {
        expect(alignForward(0x0001n, 4)).to.equal(0x0004n)
      })
    } else if (process.env.BITS === '32') {
      it('should create an aligned address from one that is not aligned', function() {
        expect(alignForward(0x0001, 4)).to.equal(0x0004)
      })
    }
  })
  describe('adjustAddress', function() {
    if (process.env.BITS === '64') {
      it(`should add a number to an address`, function() {
        expect(adjustAddress(5n, 5)).to.equal(10n);
      })

    } else if (process.env.BITS === '32') {
      it(`should add a number to an address`, function() {
        expect(adjustAddress(5, 5)).to.equal(10);
      })
    }
  })
  describe('isInvalidAddress', function() {
    if (process.env.BITS === '64') {
      it(`should return true when 0xaaaaaaaaaaaaaaaan is given`, function() {
        expect(isInvalidAddress(0xaaaaaaaaaaaaaaaan)).to.be.true;
      })
      it(`should return false when address is valid`, function() {
        expect(isInvalidAddress(0x1000n)).to.be.false;
      })
    } else if (process.env.BITS === '32') {
      it(`should return true when 0xaaaaaaaa is given`, function() {
        expect(isInvalidAddress(0xaaaaaaaa)).to.be.true;
      })
      it(`should return false when address is valid`, function() {
        expect(isInvalidAddress(0x1000)).to.be.false;
      })
    }
  })
  describe('isMisaligned', function() {
    if (process.env.BITS === '64') {
      it(`should determine whether address is misaligned`, function() {
        expect(isMisaligned(0xF000000000001000n, 2)).to.be.false;
        expect(isMisaligned(0xF000000000001001n, 2)).to.be.true;
        expect(isMisaligned(0xF000000000001002n, 2)).to.be.false;
        expect(isMisaligned(0xF000000000001002n, 4)).to.be.true;
        expect(isMisaligned(0xF000000000001004n, 4)).to.be.false;
        expect(isMisaligned(0xF000000000001004n, 8)).to.be.true;
      })
      it(`should return false when align is undefined`, function() {
        expect(isMisaligned(0xF000000000001000n, undefined)).to.be.false;
      })
    } else {
      it(`should determine whether address is misaligned`, function() {
        expect(isMisaligned(0x1000, 2)).to.be.false;
        expect(isMisaligned(0x1001, 2)).to.be.true;
        expect(isMisaligned(0x1002, 2)).to.be.false;
        expect(isMisaligned(0x1002, 4)).to.be.true;
        expect(isMisaligned(0x1004, 4)).to.be.false;
        expect(isMisaligned(0x1004, 8)).to.be.true;
      })
      it(`should return false when align is undefined`, function() {
        expect(isMisaligned(0x1000, undefined)).to.be.false;
      })
    }
  })
  describe('getSelf', function() {
    it('should return this', function() {
      const object = {};
      expect(getSelf.call(object)).to.equal(object);
    })
  })
  describe('getLength', function() {
    it('should return this[LENGTH]', function() {
      const object = {
        [LENGTH]: 123,
      };
      expect(getLength.call(object)).to.equal(123);
    })
  })
  describe('getProxy', function() {
    it('should return this[PROXY]', function() {
      const object = {
        [PROXY]: 123,
      };
      expect(getProxy.call(object)).to.equal(123);
    })
  })
  describe('toString', function() {
    it('should invoke toPrimitive with \"string\" as hint', function() {
      const object = {
        [Symbol.toPrimitive](hint) {
          switch (hint) {
            case 'string': return 'hello';
            default: return 123;
          }
        },
      };
      expect(toString.call(object)).to.equal('hello');
    })
  })
  describe('showPosixError', function() {
    it('should return Posix error code of error object', function() {
      expect(showPosixError(new InvalidFileDescriptor())).to.equal(PosixError.EBADF);
    })
    it('should return EPERM when given error without a code', function() {
      expect(showPosixError(new Error())).to.equal(PosixError.EPERM);
    })
  })
  describe('always', function() {
    it('should return true', function() {
      expect(always()).to.be.true;
    })
  })
  describe('never', function() {
    it('should return false', function() {
      expect(never()).to.be.false;
    })
  })
  describe('empty', function() {
    it('should do nothing', function() {
      expect(empty()).to.be.undefined;
    })
  })
  describe('usize', function() {
    if (process.env.BITS === '32') {
      it('should return a number', function() {
        expect(usize(1234)).to.be.a('number');
      })
    } else if (process.env.BITS === '64') {
      it('should return a big int', function() {
        expect(usize(1234)).to.be.a('bigint');
      })
    }
  })

})
