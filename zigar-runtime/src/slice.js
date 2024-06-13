import {
  canBeString, createArrayProxy, getArrayEntries, getArrayIterator, getChildVivificator,
  getPointerVisitor, makeArrayReadOnly, transformIterable
} from './array.js';
import { getCompatibleTags, getTypedArrayClass } from './data-view.js';
import {
  ArrayLengthMismatch, InvalidArrayInitializer, MisplacedSentinel, MissingSentinel
} from './error.js';
import { getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { attachDescriptors, createConstructor, createPropertyApplier } from './object.js';
import { copyPointer, getProxy } from './pointer.js';
import {
  convertToJSON, getBase64Descriptor, getDataViewDescriptor, getStringDescriptor,
  getTypedArrayDescriptor, getValueOf
} from './special.js';
import {
  ALIGN, COMPAT, COPIER, ENTRIES_GETTER, LENGTH, MEMORY, POINTER_VISITOR, SIZE, TYPE, VIVIFICATOR,
  WRITE_DISABLER
} from './symbol.js';
import { MemberType } from './types.js';

export function defineSlice(structure, env) {
  const {
    align,
    instance: {
      members: [ member ],
    },
    hasPointer,
  } = structure;
  /* DEV-TEST */
  /* c8 ignore next 6 */
  if (member.bitOffset !== undefined) {
    throw new Error(`bitOffset must be undefined for slice member`);
  }
  if (member.slot !== undefined) {
    throw new Error(`slot must be undefined for slice member`);
  }
  /* DEV-TEST-END */
  const { get, set } = getDescriptor(member, env);
  const { byteSize: elementSize, structure: elementStructure } = member;
  const sentinel = getSentinel(structure, env);
  if (sentinel) {
    // zero-terminated strings aren't expected to be commonly used
    // so we're not putting this prop into the standard structure
    structure.sentinel = sentinel;
  }
  const hasStringProp = canBeString(member);
  const shapeDefiner = function(dv, length, fixed = false) {
    if (!dv) {
      dv = env.allocateMemory(length * elementSize, align, fixed);
    }
    this[MEMORY] = dv;
    this[LENGTH] = length;
  };
  const shapeChecker = function(arg, length) {
    if (length !== this[LENGTH]) {
      throw new ArrayLengthMismatch(structure, this, arg);
    }
  };
  // the initializer behave differently depending on whether it's called by the
  // constructor or by a member setter (i.e. after object's shape has been established)
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg, fixed = false) {
    if (arg instanceof constructor) {
      if (!this[MEMORY]) {
        shapeDefiner.call(this, null, arg.length, fixed);
      } else {
        shapeChecker.call(this, arg, arg.length);
      }
      this[COPIER](arg);
      if (hasPointer) {
        this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
      }
    } else if (typeof(arg) === 'string' && hasStringProp) {
      initializer.call(this, { string: arg }, fixed);
    } else if (arg?.[Symbol.iterator]) {
      arg = transformIterable(arg);
      if (!this[MEMORY]) {
        shapeDefiner.call(this, null, arg.length, fixed);
      } else {
        shapeChecker.call(this, arg, arg.length);
      }
      let i = 0;
      for (const value of arg) {
        sentinel?.validateValue(value, i, arg.length);
        set.call(this, i++, value);
      }
    } else if (typeof(arg) === 'number') {
      if (!this[MEMORY] && arg >= 0 && isFinite(arg)) {
        shapeDefiner.call(this, null, arg);
      } else {
        throw new InvalidArrayInitializer(structure, arg, !this[MEMORY]);
      }
    } else if (arg && typeof(arg) === 'object') {
      if (propApplier.call(this, arg, fixed) === 0) {
        throw new InvalidArrayInitializer(structure, arg);
      }
    } else if (arg !== undefined) {
      throw new InvalidArrayInitializer(structure, arg);
    }
  };
  const finalizer = createArrayProxy;
  const constructor = structure.constructor = createConstructor(structure, { initializer, shapeDefiner, finalizer }, env);
  const typedArray = structure.typedArray = getTypedArrayClass(member);
  const hasObject = member.type === MemberType.Object;
  const shapeHandlers = { shapeDefiner };
  const instanceDescriptors = {
    $: { get: getProxy, set: initializer },
    length: { get: getLength },
    dataView: getDataViewDescriptor(structure, shapeHandlers),
    base64: getBase64Descriptor(structure, shapeHandlers),
    string: hasStringProp && getStringDescriptor(structure, shapeHandlers),
    typedArray: typedArray && getTypedArrayDescriptor(structure, shapeHandlers),
    get: { value: get },
    set: { value: set },
    entries: { value: getArrayEntries },
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [Symbol.iterator]: { value: getArrayIterator },
    [ENTRIES_GETTER]: { value: getArrayEntries },
    [COPIER]: { value: getMemoryCopier(elementSize, true) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator(structure, env, true) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(structure) },
    [WRITE_DISABLER]: { value: makeArrayReadOnly },
  };
  const staticDescriptors = {
    child: { get: () => elementStructure.constructor },
    [COMPAT]: { value: getCompatibleTags(structure) },
    [ALIGN]: { value: align },
    [SIZE]: { value: elementSize },
    [TYPE]: { value: structure.type },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
}

function getLength() {
  return this[LENGTH];
}

export function getSentinel(structure, env) {
  const {
    runtimeSafety = true,
  } = env;
  const {
    byteSize,
    instance: { members: [ member, sentinel ], template },
  } = structure;
  if (!sentinel) {
    return;
  }
  /* DEV-TEST */
  /* c8 ignore next 3 */
  if (sentinel.bitOffset === undefined) {
    throw new Error(`bitOffset must be 0 for sentinel member`);
  }
  /* DEV-TEST-END */
  const { get: getSentinelValue } = getDescriptor(sentinel, env);
  const value = getSentinelValue.call(template, 0);
  const { get } = getDescriptor(member, env);
  const validateValue = (runtimeSafety) ? function(v, i, l) {
    if (v === value && i !== l - 1) {
      throw new MisplacedSentinel(structure, v, i, l);
    } else if (v !== value && i === l - 1) {
      throw new MissingSentinel(structure, value, i, l);
    }
  } : function(v, i, l) {
    if (v !== value && i === l - 1) {
      throw new MissingSentinel(structure, value, l);
    }
  };
  const validateData = (runtimeSafety) ? function(source, len) {
    for (let i = 0; i < len; i++) {
      const v = get.call(source, i);
      if (v === value && i !== len - 1) {
        throw new MisplacedSentinel(structure, value, i, len);
      } else if (v !== value && i === len - 1) {
        throw new MissingSentinel(structure, value, len);
      }
    }
  } : function(source, len) {
    if (len * byteSize === source[MEMORY].byteLength) {
      const i = len - 1;
      const v = get.call(source, i);
      if (v !== value) {
        throw new MissingSentinel(structure, value, len);
      }
    }
  };
  const bytes = template[MEMORY];
  return { value, bytes, validateValue, validateData };
}