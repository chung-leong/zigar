import { MemberType, OptionalFlag, StructureFlag, VisitorFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { INITIALIZE, MEMORY, VISIT, VIVIFICATE } from '../symbols.js';
import { clearView, copyObject, defineValue, isCompatibleInstanceOf } from '../utils.js';

export default mixin({
  defineOptional(structure, descriptors) {
    const {
      instance: { members: [ valueMember, presentMember ] },
      flags,
    } = structure;
    const { get: getValue, set: setValue } = this.defineMember(valueMember);
    const { get: getPresent, set: setPresent } = this.defineMember(presentMember);
    const get = function() {
      const present = getPresent.call(this);
      if (present) {
        return getValue.call(this);
      } else {
        this[VISIT]?.('clear', VisitorFlag.IgnoreUncreated);
        return null;
      }
    };
    const isValueVoid = valueMember.type === MemberType.Void;
    const { bitOffset, byteSize } = valueMember;
    const initializer = this.createInitializer(function(arg, allocator) {
      if (isCompatibleInstanceOf(arg, constructor)) {
        copyObject(this, arg);
        if (flags & StructureFlag.HasPointer) {
          // don't bother copying pointers when it's empty
          if (getPresent.call(this)) {
            this[VISIT]('copy', VisitorFlag.Vivificate, arg);
          }
        }
      } else if (arg === null) {
        setPresent.call(this, 0);
        if (flags & OptionalFlag.HasSelector) {
          clearView(this[MEMORY], bitOffset >> 3, byteSize);
        }
        // clear references so objects can be garbage-collected
        this[VISIT]?.('clear', VisitorFlag.IgnoreUncreated);
      } else if (arg !== undefined || isValueVoid) {
        // call setValue() first, in case it throws
        setValue.call(this, arg, allocator);
        if (flags & OptionalFlag.HasSelector) {
          setPresent.call(this, 1);
        } else if (flags & StructureFlag.HasPointer) {
          // since setValue() wouldn't write address into memory when the target is in
          // JS memory, we need to use setPresent() in order to write something
          // non-zero there so that we know the field is populated
          if (!getPresent.call(this)) {
            setPresent.call(this, 13);
          }
        }
      }
    });
    const constructor = structure.constructor = this.createConstructor(structure);
    descriptors.$ = { get, set: initializer };
    // we need to clear the value portion when there's a separate bool indicating whether a value
    // is present; for optional pointers, the bool overlaps the usize holding the address; setting
    // it to false automatically clears the address
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorOptional(valueMember, getPresent);
    return constructor;
  },
});
