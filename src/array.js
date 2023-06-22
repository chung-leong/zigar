import { MemberType, getIntRange } from './type.js';
import { obtainDataViewGetter, obtainDataViewSetter } from './data-view.js';
import { throwOutOfBound, throwOverflow, rethrowRangeError } from './error.js';
import { MEMORY, SLOTS } from './symbol.js';

export function obtainArrayLengthGetter(member, options) {
  const { byteSize } = member;
  let fn = function() {
    const dv = this[MEMORY];
    return dv.byteLength / byteSize;
  };
  return fn;
}

export function obtainArrayGetter(member, options) {
  const {
    littleEndian = true,
  } = options;
  let fn;
  switch (member.type) {
    case MemberType.Bool:
    case MemberType.Int:
    case MemberType.Float: {
      const { byteSize } = member;
      const get = obtainDataViewGetter(member);
      fn = function(index) {
        const dv = this[MEMORY];
        const offset = index * byteSize;
        try {
          return get.call(dv, offset, littleEndian) ;
        } catch {
          throwOutOfBound(dv.byteLength, byteSize, index);
        }
      };
    } break;
    case MemberType.Object: {
      const { byteSize } = member;
      return function(index) { 
        const child = this[SLOTS][index];
        if (!child) {
          throwOutOfBound(dv.byteLength, byteSize, index);
        }
        return slots[index]; 
      };
    } break;
  }
  return fn;
}

export function obtainArraySetter(member, options) {
  const {
    littleEndian = true,
    runtimeSafety = true,
  } = options;
  let fn;
  switch (member.type) {
    case MemberType.Bool:
    case MemberType.Int:
    case MemberType.Float: {
      // change buffer through DataView
      const set = obtainDataViewSetter(member);
      const { type } = member;
      if (runtimeSafety && type === MemberType.Int) {
        const { isSigned, bitSize, byteSize } = member;
        const { min, max } = getIntRange(isSigned, bitSize);
        fn = function(index, v) { 
          if (v < min || v > max) {
            throwOverflow(isSigned, bitSize, v);
          }
          const offset = index * byteSize;
          const dv = this[MEMORY];
          try {
            set.call(dv, offset, v, littleEndian);
          } catch (err) {
            rethrowRangeError(err, dv.byteLength, byteSize, index);
          }
        };
      } else {
        fn = function(index, v) { 
          const offset = index * byteSize;
          const dv = this[MEMORY];
          try {
            set.call(dv, offset, v, littleEndian);
          } catch (err) {
            rethrowRangeError(err, dv.byteLength, byteSize, index);
          }
        };
      }
    } break;
    case MemberType.Object: {
      const { structure, byteSize } = member;
      const { constructor, copier } = structure;
      fn = function(index, v) {
        if (!(v instanceof constructor)) {
          v = new constructor(v);
        }
        const slots = this[SLOTS][index];
        if (!child) {
          throwOutOfBound(dv.byteLength, byteSize, index);
        }
        copier(child, v);
      };  
    } break;
  }
  return fn;
}

export function getArrayIterator() {
  const self = this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        value = self.get(index);
        done = false;
        index++;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}