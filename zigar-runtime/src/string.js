import { MemberType } from './member.js';
import { MEMORY } from '../src/symbol.js';

export function addStringAccessors(s) {
  const {
    instance: {
      members: [ member ],
    }
  } = s;
  const get = getStringGetter(member);
  if (get) {
    Object.defineProperties(constructor.prototype, {
      string: { get, configurable: true },
    });
  }
}

export function getStringGetter(member) {
  const { type, isSigned, bitSize } = member;
  if (type === MemberType.Int && !isSigned) {
    if (bitSize === 8 || bitSize === 16) {
      const byteSize = bitSize / 8;
      return function () {
        const dv = this[MEMORY];
        const TypedArray = (bitSize === 8) ? Int8Array : Int16Array;
        const ta = new TypedArray(dv.buffer, dv.byteOffset, dv.byteLength / byteSize);
        return (new TextDecoder(`utf-${bitSize}`)).decode(ta);
      };
    }
  }
}
