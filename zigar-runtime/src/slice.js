import { defineProperties } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getMemoryCopier } from './memory.js';
import { requireDataView, addTypedArray, checkDataViewSize, getCompatibleTags } from './data-view.js';
import { getArrayIterator, createProxy, createArrayEntries, getChildVivificator, getPointerVisitor } from './array.js';
import { copyPointer, getProxy } from './pointer.js';
import { checkDataView, getDataViewFromTypedArray, getDataViewFromUTF8, getSpecialKeys } from './special.js';
import { throwInvalidArrayInitializer, throwArrayLengthMismatch, throwNoProperty,
  throwMisplacedSentinel, throwMissingSentinel, throwNoInitializer, throwReadOnly } from './error.js';
import { ALIGN, CHILD_VIVIFICATOR, COMPAT, GETTER, LENGTH, MEMORY, MEMORY_COPIER, POINTER_VISITOR,
  SENTINEL, SETTER, SIZE, SLOTS } from './symbol.js';
import { decodeBase64 } from './text.js';

export function defineSlice(s, env) {
  const {
    align,
    instance: {
      members: [ member ],
    },
    hasPointer,
  } = s;
  const typedArray = addTypedArray(s);
  /* DEV-TEST */
  /* c8 ignore next 6 */
  if (member.bitOffset !== undefined) {
    throw new Error(`bitOffset must be undefined for slice member`);
  }
  if (member.slot !== undefined) {
    throw new Error(`slot must be undefined for slice member`);
  }
  /* DEV-TEST-END */
  const hasObject = (member.type === MemberType.Object);
  const { byteSize: elementSize, structure: elementStructure } = member;
  const sentinel = getSentinel(s, env);
  if (sentinel) {
    // zero-terminated strings aren't expected to be commonly used
    // so we're not putting this prop into the standard structure
    s.sentinel = sentinel;
  }
  // the slices are different from other structures due to variability of their sizes
  // we only know the "shape" of an object after we've processed the initializers
  const constructor = s.constructor = function(arg, options = {}) {
    const {
      writable = true,
      fixed = false,
    } = options;
    const creating = this instanceof constructor;
    let self;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      initializer.call(self, arg, fixed);
    } else {
      self = Object.create(constructor.prototype);
      const dv = requireDataView(s, arg);
      shapeDefiner.call(self, dv, dv.byteLength / elementSize);
    }
    if (!writable) {
      defineProperties(self, {
        set: { value: throwReadOnly, configurable: true, writable: true },
        $: { get: getProxy, set: throwReadOnly, configurable: true },
        [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificator(s, false) },
      });
    }
    return createProxy.call(self);
  };
  const specialKeys = getSpecialKeys(s);
  const shapeDefiner = function(dv, length, fixed) {
    if (!dv) {
      dv = env.createBuffer(length * elementSize, align, fixed);
    }
    this[MEMORY] = dv;
    this[GETTER] = null;
    this[SETTER] = null;
    this[LENGTH] = length;
    if (hasObject) {
      this[SLOTS] = {};
    }
  };
  const shapeChecker = function(arg, length) {
    if (length !== this[LENGTH]) {
      throwArrayLengthMismatch(s, this, arg);
    }
  };
  // the initializer behave differently depending on whether it's called by the
  // constructor or by a member setter (i.e. after object's shape has been established)
  const initializer = function(arg, fixed) {
    let shapeless = !this.hasOwnProperty(MEMORY);
    if (arg instanceof constructor) {
      if (shapeless) {
        shapeDefiner.call(this, null, arg.length, fixed);
      } else {
        shapeChecker.call(this, arg, arg.length);
      }
      this[MEMORY_COPIER](arg);
      if (hasPointer) {
        this[POINTER_VISITOR](copyPointer, { source: arg });
      }
    } else {
      if (typeof(arg) === 'string' && specialKeys.includes('string')) {
        arg = { string: arg };
      }
      if (arg?.[Symbol.iterator]) {
        let argLen = arg.length;
        if (typeof(argLen) !== 'number') {
          arg = [ ...arg ];
          argLen = arg.length;
        }
        if (!this[MEMORY]) {
          shapeDefiner.call(this, null, argLen, fixed);
        } else {
          shapeChecker.call(this, arg, argLen);
        }
        let i = 0;
        for (const value of arg) {
          sentinel?.validateValue(value, i, argLen);
          set.call(this, i++, value);
        }
      } else if (typeof(arg) === 'number') {
        if (shapeless && arg >= 0 && isFinite(arg)) {
          shapeDefiner.call(this, null, arg);
        } else {
          throwInvalidArrayInitializer(s, arg, shapeless);
        }
      } else if (arg && typeof(arg) === 'object') {
        for (const key of Object.keys(arg)) {
          if (!(key in this)) {
            throwNoProperty(s, key);
          }
        }
        let specialFound = 0;
        for (const key of specialKeys) {
          if (key in arg) {
            specialFound++;
          }
        }
        if (specialFound === 0) {
          throwInvalidArrayInitializer(s, arg);
        }
        for (const key of specialKeys) {
          if (key in arg) {
            if (shapeless) {
              // can't use accessors since the object has no memory yet
              let dv, dup = true;
              switch (key) {
                case 'dataView':
                  dv = arg[key];
                  checkDataView(dv);
                  break;
                case 'typedArray':
                  dv = getDataViewFromTypedArray(arg[key], typedArray);
                  break;
                case 'string':
                  dv = getDataViewFromUTF8(arg[key], elementSize, sentinel?.value);
                  dup = false;
                  break;
                case 'base64':
                  dv = decodeBase64(arg[key]);
                  dup = false;
                  break;
              }
              checkDataViewSize(s, dv);
              const len = dv.byteLength / elementSize;
              const source = { [MEMORY]: dv };
              sentinel?.validateData(source, len);
              if (dup) {
                shapeDefiner.call(this, null, len);
                this[MEMORY_COPIER](source);
              } else {
                // reuse memory from string decoding
                shapeDefiner.call(this, dv, len);
              }
              shapeless = false;
            } else {
              this[key] = arg[key];
            }
          }
        }
      } else if (arg !== undefined) {
        throwInvalidArrayInitializer(s, arg);
      }
    }
  };
  const { get, set } = getDescriptor(member, env);
  defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    length: { get: getLength, configurable: true },
    $: { get: getProxy, set: initializer, configurable: true },
    entries: { value: createArrayEntries, configurable: true, writable: true },
    [Symbol.iterator]: { value: getArrayIterator, configurable: true, writable: true },
    [MEMORY_COPIER]: { value: getMemoryCopier(elementSize, true) },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificator(s, true) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(s) }
  });
  defineProperties(constructor, {
    child: { get: () => elementStructure.constructor },
    [COMPAT]: { value: getCompatibleTags(s) },
    [ALIGN]: { value: align },
    [SIZE]: { value: elementSize },
    [SENTINEL]: sentinel && { value: sentinel },
  });
  return constructor;
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
      throwMisplacedSentinel(structure, v, i, l);
    } else if (v !== value && i === l - 1) {
      throwMissingSentinel(structure, value, i, l);
    }
  } : function(v, i, l) {
    if (v !== value && i === l - 1) {
      throwMissingSentinel(structure, value, l);
    }
  };
  const validateData = (runtimeSafety) ? function(source, len) {
    for (let i = 0; i < len; i++) {
      const v = get.call(source, i);
      if (v === value && i !== len - 1) {
        throwMisplacedSentinel(structure, value, i, len);
      } else if (v !== value && i === len - 1) {
        throwMissingSentinel(structure, value, len);
      }
    }
  } : function(source, len) {
    if (len * byteSize === source[MEMORY].byteLength) {
      const i = len - 1;
      const v = get.call(source, i);
      if (v !== value) {
        throwMissingSentinel(structure, value, len);
      }
    }
  };
  const bytes = template[MEMORY];
  return { value, bytes, validateValue, validateData };
}