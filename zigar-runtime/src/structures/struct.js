import { MemberFlag, StructureFlag, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { InvalidInitializer } from '../errors.js';
import {
  getStructEntries, getStructIterator, getVectorEntries, getVectorIterator, getZigIterator
} from '../iterators.js';
import { always } from '../pointer.js';
import { COPY, ENTRIES, INITIALIZE, VISIT, VIVIFICATE } from '../symbols.js';
import { defineValue } from '../utils.js';
import { getSelf } from './all.js';

export default mixin({
  defineStruct(structure, descriptors) {
    const {
      instance: { members },
      flags,
    } = structure;
    const backingIntMember = members.find(m => m.flags & MemberFlag.IsBackingInt);
    const backingInt = backingIntMember && this.defineMember(backingIntMember);
    const propApplier = this.createApplier(structure);
    const initializer = function(arg) {
      if (arg instanceof constructor) {
        this[COPY](arg);
        if (hasPointer) {
          this[VISIT]('copy', { vivificate: true, source: arg });
        }
      } else if (arg && typeof(arg) === 'object') {
        propApplier.call(this, arg);
      } else if ((typeof(arg) === 'number' || typeof(arg) === 'bigint') && backingInt) {
        backingInt.set.call(this, arg);
      } else if (arg !== undefined) {
        throw new InvalidInitializer(structure, 'object', arg);
      }
    };
    const constructor = this.createConstructor(structure);
    // add descriptors of struct field
    for (const member of members.filter(m => !!m.name)) {
      const { set } = descriptors[member.name] = this.defineMember(member);
      if (set && member.flags & MemberFlag.IsRequired) {
        set.required = true;
      }
    }
    descriptors.$ = { get: getSelf, set: initializer };
    // add length and entries if struct is a tuple
    descriptors.length = (flags & StructureFlag.IsTuple) && {
      value: parseInt(members[members.length - 1].name) + 1,
    };
    descriptors.entries = (flags & StructureFlag.IsTuple) && {
      value: getVectorEntries,
    };
    // allow conversion of packed struct to number when there's a backing int
    descriptors[Symbol.toPrimitive] = backingInt && {
      value(hint) {
        return (hint === 'string')
          ? Object.prototype.toString.call(this)
          : backingInt.get.call(this);
      }
    };
    // add iterator
    descriptors[Symbol.iterator] = defineValue(
      (isIterator)
      ? getZigIterator
      : (isTuple)
        ? getVectorIterator
        : getStructIterator
    );
    descriptors[INITIALIZE] = defineValue(initializer);
    // for creating complex fields on access
    descriptors[VIVIFICATE] = (flags & MemberFlag.HasObject) && this.defineVivificatorStruct(structure, true);
    // for operating on pointers contained in the struct
    descriptors[VISIT] = (flags & MemberFlag.HasPointer) && this.defineVisitorStruct(structure, always);
    descriptors[ENTRIES] = { get: isTuple ? getVectorEntries : getStructEntries };
    return constructor;
  }
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.Struct;
}
