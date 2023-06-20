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
  switch (member.type) {
    case MemberType.Compound: {
      const { structure, byteSize } = member;
      const { constructor } = structure;
      return function(index) { 
        const slots = this[SLOTS];
        if (!slots[index]) {
          const dv = this[MEMORY];
          const offset = index * byteSize;
          if (offset >= 0 && offset + byteSize <= dv.byteLength) {
            const slice = new DataView(dv.buffer, dv.byteOffset + offset, size);
            slots[index] = new constructor(slice);
          } else {
            throwOutOfBound(dv.byteLength, byteSize, index);
          }
        }
        return slots[index]; 
      };
    }
    case MemberType.Pointer: {
      return function(index) { 
        const slots = this[SLOTS];
        if (!slots[index]) {
          const dv = this[MEMORY];
          const offset = index * byteSize;
          if (offset >= 0 && offset + byteSize <= dv.byteLength) {
            // pointer isn't pointing to something
          } else {
            throwOutOfBound(dv.byteLength, byteSize, index);
          }
        }
        return slots[index]; 
      };
    } 
    case MemberType.Bool:
    case MemberType.Int:
    case MemberType.Float: {
      const { byteSize } = member;
      const get = obtainDataViewGetter(member);
      return function(index) {
        const dv = this[MEMORY];
        const offset = index * byteSize;
        try {
          return get.call(dv, offset, littleEndian) ;
        } catch {
          throwOutOfBound(dv.byteLength, byteSize, index);
        }
      };
    }
  }
}

export function obtainArraySetter(member, options) {
  const {
    littleEndian = true,
    runtimeSafety = true,
  } = options;
  let fn;
  switch (member.type) {
    case MemberType.Compound: {
      const { structure, byteSize } = member;
      const { constructor, copier } = structure;
      fn = function(index, v) {
        if (!(v instanceof constructor)) {
          v = new constructor(v);
        }
        const slots = this[SLOTS];
        let reloc = slots[index];
        if (!reloc) {
          const offset = index * byteSize;
          if (offset >= 0 && offset + byteSize <= dv.byteLength) {
            const slice = new DataView(dv.buffer, dv.byteOffset + offset, size);
            reloc = slots[index] = new constructor(slice);
          } else {
            throwOutOfBound(dv.byteLength, byteSize, index);
          }
        }
        copier(reloc, v);
      };  
    } break;
    case MemberType.Pointer: {
      const { structure, byteSize, isConst } = member;
      const { constructor } = structure;
      if (isConst) {
        return;
      } 
      return function(index, v) {
        if (!(v instanceof constructor)) {
          v = new constructor(v);
        }
        const dv = this[MEMORY];
        const offset = index * byteSize;
        if (offset >= 0 && offset + byteSize <= dv.byteLength) {
          this[SLOTS][index] = v;
        } else {
          throwOutOfBound(dv.byteLength, byteSize, index);
        }
      };    
    }
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