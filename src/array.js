import { MemberType, getIntRange } from './types.js';
import { obtainDataViewGetter, obtainDataViewSetter } from './data-view.js';
import { throwOutOfBound, throwOverflow } from './errors.js';
import { DATA, RELOCATABLE } from './symbols.js';

export function obtainArrayLengthGetter(member, options) {
  const { align } = member;
  var fn = function() {
    const dv = this[DATA];
    return dv.byteLength / align;
  };
  return fn;
}

export function obtainArrayGetter(member, options) {
  const {
    littleEndian = true,
  } = options;
  switch (member.type) {
    case MemberType.Compound: {
      const { struct, align } = member;
      return function(index) { 
        const relocs = this[RELOCATABLE];
        if (!relocs[index]) {
          const dv = this[DATA];
          const offset = index * align;
          if (offset >= 0 && offset + align <= dv.byteLength) {
            const slice = new DataView(dv.buffer, dv.byteOffset + offset, size);
            relocs[index] = new struct(slice);
          } else {
            throwOutOfBound(dv, align, index);
          }
        }
        return relocs[index]; 
      };
    }
    case MemberType.Pointer: {
      return function(index) { return this[RELOCATABLE][index] };
    } 
    case MemberType.Bool:
    case MemberType.Int:
    case MemberType.Float: {
      const { align } = member;
      const get = obtainDataViewGetter(member);
      return function(index) { 
        const offset = index * align;
        return get.call(this[DATA], offset, littleEndian) ;
      };
    }
  }
}

export function obtainArraySetter(member, options) {
  const {
    littleEndian = true,
    runtimeSafety = true,
  } = options;
  var fn;
  switch (member.type) {
    case MemberType.Compound: {
      const { struct, align } = member;
      fn = function(index, v) {
        if (!(v instanceof struct)) {
          v = new struct(v);
        }
        const relocs = this[RELOCATABLE];
        if (!relocs[index]) {
          const dv = this[DATA];
          const offset = index * align;
          if (offset >= 0 && offset + align <= dv.byteLength) {
            const slice = new DataView(dv.buffer, dv.byteOffset + offset, size);
            relocs[index] = new struct(slice);
          } else {
            throwOutOfBound(dv, align, index);
          }
        }
        const copy = struct[COPY];
        copy.call(relocs[index], v);
      };  
    } break;
    case MemberType.Pointer: {
      const { struct, mutable, align } = member;
      if (!mutable) {
        return;
      } 
      return function(index, v) {
        if (!(v instanceof struct)) {
          v = new struct(v);
        }
        const dv = this[DATA];
        const offset = index * align;
        if (offset >= 0 && offset + align <= dv.byteLength) {
          this[RELOCATABLE][index] = v;
        } else {
          throwOutOfBound(dv, align, index);
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
        const { bits, signed, align } = member;
        const { min, max } = getIntRange(bits, signed);
        fn = function(index, v) { 
          if (v < min || v > max) {
            throwOverflow(bits, signed, v);
          }
          const offset = index * align;
          try {
            set.call(this[DATA], offset, v, littleEndian);
          } catch (err) {
            throwOutOfBound(dv, align, index);
          }
        };
      } else {
        fn = function(index, v) { 
          const offset = index * align;
          try {
            set.call(this[DATA], offset, v, littleEndian);
          } catch (err) {
            throwOutOfBound(dv, align, index);
          }
        };
      }
    } break;
  }
  return fn;
}
