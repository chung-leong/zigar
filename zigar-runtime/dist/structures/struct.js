import { MemberFlag, StructFlag, StructureFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { InvalidInitializer } from '../errors.js';
import { getVectorEntries, getZigIterator, getVectorIterator, getStructIterator, getStructEntries } from '../iterators.js';
import { SETTERS, KEYS, INITIALIZE, VIVIFICATE, VISIT, ENTRIES, PROPS, COPY } from '../symbols.js';
import { getSelf, defineValue } from '../utils.js';

var struct = mixin({
  defineStruct(structure, descriptors) {
    const {
      flags,
      length,
      instance: { members },
    } = structure;
    const backingIntMember = members.find(m => m.flags & MemberFlag.IsBackingInt);
    const backingInt = backingIntMember && this.defineMember(backingIntMember);
    const propApplier = this.createApplier(structure);
    const initializer = function(arg) {
      if (arg instanceof constructor) {
        this[COPY](arg);
        if (flags & StructureFlag.HasPointer) {
          this[VISIT]('copy', 0, arg);
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
    const setters = descriptors[SETTERS].value;
    const keys = descriptors[KEYS].value;
    const props = [];
    for (const member of members.filter(m => !!m.name)) {
      const { name, flags } = member;
      const { set } = descriptors[name] = this.defineMember(member);
      if (set) {
        if (flags & MemberFlag.IsRequired) {
          set.required = true;
        }
        setters[name] = set;
        keys.push(name);
      }
      props.push(name);
    }
    descriptors.$ = { get: getSelf, set: initializer };
    // add length and entries if struct is a tuple
    descriptors.length = defineValue(length);
    descriptors.entries = (flags & StructFlag.IsTuple) && {
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
      (flags & StructFlag.IsIterator)
      ? getZigIterator
      : (flags & StructFlag.IsTuple)
        ? getVectorIterator
        : getStructIterator
    );
    descriptors[INITIALIZE] = defineValue(initializer);
    // for creating complex fields on access
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    // for operating on pointers contained in the struct
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorStruct(members);
    descriptors[ENTRIES] = { get: (flags & StructFlag.IsTuple) ? getVectorEntries : getStructEntries };
    descriptors[PROPS] = defineValue(props);
    if (flags & StructFlag.IsAllocator) {
      descriptors.alloc = this.defineAlloc();
      descriptors.free = this.defineFree();
      descriptors.dupe = this.defineDupe();
    }
    return constructor;
  }
});

export { struct as default };
