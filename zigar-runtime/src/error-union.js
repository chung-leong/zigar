import { getGlobalErrorSet } from './error-set.js';
import { throwNotInErrorSet } from './error.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier, getMemoryResetter } from './memory.js';
import { copyPointer, resetPointer } from './pointer.js';
import { convertToJSON, getBase64Descriptor, getDataViewDescriptor, getValueOf } from './special.js';
import { getChildVivificator, getPointerVisitor } from './struct.js';
import { attachDescriptors, createConstructor, createPropertyApplier } from './structure.js';
import {
  ALIGN,
  COPIER,
  NORMALIZER,
  RESETTER,
  SIZE,
  VISITOR,
  VIVIFICATOR
} from './symbol.js';

export function defineErrorUnion(structure, env) {
  const {
    byteSize,
    align,
    instance: { members },
    hasPointer,
  } = structure;
  const { get: getValue, set: setValue } = getDescriptor(members[0], env);
  const { get: getError, set: setError } = getDescriptor(members[1], env);
  const get = function() {
    const error = getError.call(this, true);
    if (error) {
      throw error;
    } else {
      return getValue.call(this);
    }
  };
  const isValueVoid = members[0].type === MemberType.Void;
  const acceptAny = members[1].structure.name === 'anyerror';
  const TargetError = (acceptAny) ? getGlobalErrorSet() : members[1].structure.constructor;
  const isChildActive = function() {
    return !getError.call(this, true);
  };
  const clearValue = function() {
    this[RESETTER]();
    this[VISITOR]?.(resetPointer);
  };
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[COPIER](arg);
      if (hasPointer) {
        if (isChildActive.call(this)) {
          this[VISITOR](copyPointer, { vivificate: true, source: arg });
        }
      }
    } else if (arg instanceof TargetError) {
      setError.call(this, arg);
      clearValue.call(this);
    } else if (arg !== undefined || isValueVoid) {
      try {
        // call setValue() first, in case it throws
        setValue.call(this, arg);
        setError.call(this, 0, true);
      } catch (err) {
        if (arg instanceof Error) {
          // we give setValue a chance to see if the error is actually an acceptable value
          // now is time to throw an error
          throwNotInErrorSet(structure);
        } else if (arg && typeof(arg) === 'object') {
          try {
            if (propApplier.call(this, arg) === 0) {
              throw err;
            }
          } catch (err) {
            const { error } = arg;
            if (typeof(error) === 'string') {
              setError.call(this, error);
              clearValue.call(this);
            } else {
              throw err;
            }   
          }                   
        } else {
          throw err;
        }
      }
    }
  };  
  const constructor = structure.constructor = createConstructor(structure, { initializer }, env);
  const { bitOffset: valueBitOffset, byteSize: valueByteSize } = members[0];
  const instanceDescriptors = {
    '$': { get, set: initializer },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [RESETTER]: { value: getMemoryResetter(valueBitOffset / 8, valueByteSize) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator(structure) },
    [VISITOR]: hasPointer && { value: getPointerVisitor(structure, { isChildActive }) },
    [NORMALIZER]: { value: normalizeErrorUnion },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
}

export function normalizeErrorUnion(map, forJSON) {
  try {
    const value = this.$;
    return value[NORMALIZER]?.(map, forJSON) ?? value;
  } catch (err) {
    if (forJSON) {
      return { error: err.message };
    } else {
      throw err;
    }
  }
}
