import { MemberType, OptionalFlag, StructureFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { COPY, FIXED, INITIALIZE, MEMORY, RESET, VISIT, VIVIFICATE } from '../symbols.js';
import { defineValue } from '../utils.js';

export default mixin({
  defineOptional(structure, descriptors) {
    const {
      instance: { members },
      flags,
    } = structure;
    const { get: getValue, set: setValue } = this.defineMember(members[0]);
    const { get: getPresent, set: setPresent } = this.defineMember(members[1]);
    const get = function() {
      const present = getPresent.call(this);
      if (present) {
        return getValue.call(this);
      } else {
        this[VISIT]?.('reset');
        return null;
      }
    };
    const isValueVoid = members[0].type === MemberType.Void;
    const isChildActive = function () {

      return !!getPresent.call(this);
    };
    const initializer = function(arg) {
      if (arg instanceof constructor) {
        this[COPY](arg);
        if (flags & StructureFlag.HasPointer) {
          // don't bother copying pointers when it's empty
          if (isChildActive.call(arg)) {
            this[VISIT]('copy', { vivificate: true, source: arg });
          }
        }
      } else if (arg === null) {
        setPresent.call(this, 0);
        this[RESET]?.();
        // clear references so objects can be garbage-collected
        this[VISIT]?.('reset');
      } else if (arg !== undefined || isValueVoid) {
        // call setValue() first, in case it throws
        setValue.call(this, arg);
        if (flags & OptionalFlag.HasSelector || !this[MEMORY][FIXED]) {
          // since setValue() wouldn't write address into memory when the pointer is in
          // relocatable memory, we need to use setPresent() in order to write something
          // non-zero there so that we know the field is populated
          setPresent.call(this, 1);
        }
      }
    };
    const constructor = structure.constructor = this.createConstructor(structure);
    const { bitOffset, byteSize } = members[0];
    descriptors.$ = { get, set: initializer };
    // we need to clear the value portion when there's a separate bool indicating whether a value
    // is present; for optional pointers, the bool overlaps the usize holding the address; setting
    // it to false automatically clears the address
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[RESET] = (flags & OptionalFlag.HasSelector) && this.defineResetter(bitOffset / 8, byteSize);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorStruct(structure, { isChildActive });
    return constructor;
  },
});
