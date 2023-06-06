import { MemberType, getIntRange } from './types.js';
import { obtainDataViewGetter, obtainDataViewSetter } from './data-view.js';
import { DATA, RELOCATABLE } from './symbols.js';

export function obtainGetter(member, options) {
  const {
    littleEndian = true,
  } = options;
  switch (member.type) {
    case MemberType.Compound:
    case MemberType.Pointer: {
      // get object from slot
      const { slot } = member;
      return function() { return this[RELOCATABLE][slot] };
    } 
    case MemberType.Bool:
    case MemberType.Int:
    case MemberType.Float: {
      // get value from buffer through DataView
      const get = obtainDataViewGetter(member);
      const { bitOffset } = member;
      const offset = bitOffset >> 3;
      return function() { return get.call(this[DATA], offset, littleEndian) };
    }
    case MemberType.Void: {
      return function() { return null }; 
    }
  }
}

export function obtainSetter(member, options) {
  const {
    littleEndian = true,
    runtimeSafety = true,
  } = options;
  var fn;
  switch (member.type) {
    case MemberType.Compound: {
      const { slot, struct } = member;
      fn = function(v) {
        if (!(v instanceof struct)) {
          v = new struct(v);
        }
        const reloc = this[RELOCATABLE][slot];
        const copy = reloc[COPY];
        copy.call(reloc, v);
      };  
    } break;
    case MemberType.Pointer: {
      const { slot, struct, mutable } = member;
      if (!mutable) {
        return;
      } 
      return function(v) {
        if (!(v instanceof struct)) {
          v = new struct(v);
        }
        this[RELOCATABLE][slot] = v;
      };    
    }
    case MemberType.Bool:
    case MemberType.Int:
    case MemberType.Float: {
      // change buffer through DataView
      const set = obtainDataViewSetter(member);
      const { type, bitOffset } = member;
      const offset = bitOffset >> 3;
      if (runtimeSafety && type === MemberType.Int) {
        const { bits, signed } = member;
        const { min, max } = getIntRange(bits, signed);
        fn = function(v) { 
          if (v < min || v > max) {
            throwOverflow(bits, signed, v);
          }
          set.call(this[DATA], offset, v, littleEndian);
        };
      } else {
        fn = function(v) { set.call(this[DATA], offset, v, littleEndian) };
      }
    } break;
    case MemberType.Void: {
      fn = function() {};
    } break;
  }
  return fn;
}
