import { MemberType, StructureFlag, VisitorFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { NotInErrorSet, isErrorJSON } from '../errors.js';
import { VISIT, CLASS, INITIALIZE, VIVIFICATE, MEMORY } from '../symbols.js';
import { isCompatibleInstanceOf, copyObject, defineValue, clearView } from '../utils.js';

var errorUnion = mixin({
  defineErrorUnion(structure, descriptors) {
    const {
      instance: { members: [ valueMember, errorMember ] },
      flags,
    } = structure;
    const { get: getValue, set: setValue } = this.defineMember(valueMember);
    const { get: getError, set: setError } = this.defineMember(errorMember);
    const { get: getErrorNumber, set: setErrorNumber } = this.defineMember(errorMember, false);
    const get = function() {
      const errNum = getErrorNumber.call(this);
      if (errNum) {
        throw getError.call(this);
      } else {
        return getValue.call(this);
      }
    };
    const isValueVoid = valueMember.type === MemberType.Void;
    const ErrorSet = errorMember.structure.constructor;
    const { bitOffset, byteSize } = valueMember;
    const clearValue = function() {
      clearView(this[MEMORY], bitOffset >> 3, byteSize);
      this[VISIT]?.('clear', VisitorFlag.IgnoreUncreated);
    };
    const propApplier = this.createApplier(structure);
    const initializer = this.createInitializer(function(arg, allocator) {
      if (isCompatibleInstanceOf(arg, constructor)) {
        copyObject(this, arg);
        if (flags & StructureFlag.HasPointer) {
          if (!getErrorNumber.call(this)) {
            this[VISIT]('copy', 0, arg);
          }
        }
      } else if (arg instanceof ErrorSet[CLASS] && ErrorSet(arg)) {
        setError.call(this, arg);
        clearValue.call(this);
      } else if (arg !== undefined || isValueVoid) {
        try {
          // call setValue() first, in case it throws
          setValue.call(this, arg, allocator);
          setErrorNumber.call(this, 0);
          return;
        } catch (err) {
          if (arg instanceof Error) {
            const match = ErrorSet(arg) ?? ErrorSet.Unexpected;
            if (match) {
              setError.call(this, match);
              clearValue.call(this);
            } else {
              // we gave setValue a chance to see if the error is actually an acceptable value
              // now is time to throw an error
              throw new NotInErrorSet(errorMember.structure, arg);
            }
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
    });
    const constructor = this.createConstructor(structure);
    descriptors.$ = { get, set: initializer };
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    // for operating on pointers contained in the error union
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorErrorUnion(valueMember, getErrorNumber);
    return constructor;
  },
});

export { errorUnion as default };
