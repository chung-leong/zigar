import { MemberType, StructureFlag, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { NotInErrorSet } from '../errors.js';
import { resetPointer } from '../pointer.js';
import { CLASS, COPY, INITIALIZE, RESET, VISIT, VIVIFICATE } from '../symbols.js';
import { isErrorJSON } from '../types.js';
import { defineValue } from '../utils.js';

export default mixin({
  defineErrorUnion(structure, descriptors) {
    const {
      instance: { members },
      flags,
    } = structure;
    const { get: getValue, set: setValue } = this.defineMember(members[0]);
    const { get: getError, set: setError } = this.defineMember(members[1]);
    const { get: getErrorNumber, set: setErrorNumber } = this.defineMember(members[1], false);
    const get = function() {
      const errNum = getErrorNumber.call(this);
      if (errNum) {
        throw getError.call(this);
      } else {
        return getValue.call(this);
      }
    };
    const isValueVoid = members[0].type === MemberType.Void;
    const errorSet = members[1].structure.constructor;
    const isChildActive = function() {
      return !getErrorNumber.call(this);
    };
    const clearValue = function() {
      this[RESET]();
      this[VISIT]?.(resetPointer);
    };
    const propApplier = this.createApplier(structure);
    const initializer = function(arg) {
      if (arg instanceof constructor) {
        this[COPY](arg);
        if (hasPointer) {
          if (isChildActive.call(this)) {
            this[VISIT]('copy', { vivificate: true, source: arg });
          }
        }
      } else if (arg instanceof errorSet[CLASS] && errorSet(arg)) {
        setError.call(this, arg);
        clearValue.call(this);
      } else if (arg !== undefined || isValueVoid) {
        try {
          // call setValue() first, in case it throws
          setValue.call(this, arg);
          setErrorNumber.call(this, 0);
        } catch (err) {
          if (arg instanceof Error) {
            // we gave setValue a chance to see if the error is actually an acceptable value
            // now is time to throw an error
            throw new NotInErrorSet(structure);
          } else if (isErrorJSON(arg)) {
            // setValue() failed because the argument actually is an error as JSON
            setError.call(this, arg);
            clearValue.call(this);
          } else if (arg && typeof(arg) === 'object') {
            // maybe the argument contains a special property like `dataView` or `base64`
            if (propApplier.call(this, arg) === 0) {
              // propApplier() found zero prop, so it's time to throw
              throw err;
            }
          } else {
            throw err;
          }
        }
      }
    };
    const constructor = this.createConstructor(structure, { initializer });
    descriptors.$ = { get, set: initializer };
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    // for clear value after error union is set to an an error (from mixin "features/data-copying")
    descriptors[RESET] = this.getResetterDescriptor(members[0].bitOffset / 8, members[0].byteSize);
    // for operating on pointers contained in the error union
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorStruct(structure, { isChildActive });
    return constructor;
  },
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.ErrorUnion;
}
