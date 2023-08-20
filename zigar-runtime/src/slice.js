import { MemberType, getAccessors } from './member.js';
import { getMemoryCopier } from './memory.js';
import { requireDataView, getTypedArrayClass, isTypedArray, getCompatibleTags, getDataView, checkDataViewSize } from './data-view.js';
import {
  createChildObjects,
  getPointerCopier,
  getPointerResetter,
  getPointerDisabler,
  getArrayIterator,
  createProxy,
} from './array.js';
import { addSpecialAccessors, checkDataView, getDataViewFromBase64, getDataViewFromTypedArray, getDataViewFromUTF8, getSpecialKeys } from './special.js';
import { throwInvalidArrayInitializer, throwArrayLengthMismatch, throwNoProperty } from './error.js';
import { LENGTH, MEMORY, SLOTS, GETTER, SETTER, COMPAT } from './symbol.js';

export function finalizeSlice(s) {
  const {
    instance: {
      members: [ member ],
    },
    hasPointer,
    options,
  } = s;
  if (process.env.NODE_DEV !== 'production') {
    /* c8 ignore next 6 */
    if (member.bitOffset !== undefined) {
      throw new Error(`bitOffset must be undefined for slice member`);
    }
    if (member.slot !== undefined) {
      throw new Error(`slot must be undefined for slice member`);
    }
  }
  const objectMember = (member.type === MemberType.Object) ? member : null;
  const { byteSize: elementSize, structure: elementStructure } = member;
  const typedArray = s.typedArray = getTypedArrayClass(member);
  // the slices are different from other structures due to their variable sizes
  // we only know the "shape" of an object after we've processed the initializers
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self;
    if (creating) {
      self = this;
      initializer.call(self, arg);
    } else {
      self = Object.create(constructor.prototype);
      const dv = requireDataView(s, arg, typedArray);
      shapeDefiner.call(self, dv, dv.byteLength / elementSize, this);
    }
    return createProxy.call(self);
  };
  const copy = getMemoryCopier(elementSize, true);
  const specialKeys = getSpecialKeys(s);
  const shapeDefiner = function(dv, length, recv = null) {
    if (!dv) {
      dv = new DataView(new ArrayBuffer(length * elementSize));
    }
    Object.defineProperties(this, {
      [MEMORY]: { value: dv, configurable: true, writable: true },
      [GETTER]: { value: null, configurable: true, writable: true },
      [SETTER]: { value: null, configurable: true, writable: true },
      [LENGTH]: { value: length, configurable: true, writable: true },
    });
    if (objectMember) {
      createChildObjects.call(this, objectMember, recv);
    }
  };
  const shapeChecker = function(arg, length) {
    if (length !== this[LENGTH]) {
      throwArrayLengthMismatch(s, this, arg);
    }
  };
  // the initializer behave differently depending on whether it's called  by the
  // constructor or by a member setter (i.e. after object's shape has been established)
  const initializer = s.initializer = function(arg) {
    let shapeless = !this.hasOwnProperty(MEMORY);
    if (arg instanceof constructor) {
      if (shapeless) {
        shapeDefiner.call(this, null, arg.length);
      } else {
        shapeChecker.call(this, arg, arg.length);
      }
      copy(this[MEMORY], arg[MEMORY]);
      if (pointerCopier) {
        pointerCopier.call(this, arg);
      }
    } else {
      if (typeof(arg) === 'string' && specialKeys.includes('string')) {
        arg = { string: arg };
      }
      if (arg && arg[Symbol.iterator]) {
        let argLen = arg.length;
        if (typeof(argLen) !== 'number') {
          arg = [ ...arg ];
          argLen = arg.length;
        }
        if (!this[MEMORY]) {
          shapeDefiner.call(this, null, argLen);
        } else {
          shapeChecker.call(this, arg, argLen);
        }
        let i = 0;
        for (const value of arg) {
          set.call(this, i, value);
          i++;
        }
      } else if (typeof(arg) === 'number') {
        if (shapeless && arg >= 0 && isFinite(arg)) {
          shapeDefiner.call(this, null, arg);
        } else {
          throwInvalidArrayInitializer(s, arg, shapeless);
        }
      } else if (arg && typeof(arg) === 'object') {
        const keys = Object.keys(arg);
        for (const key of keys) {
          if (!specialKeys.includes(key)) {
            throwNoProperty(s, key);
          }
        }
        if (!keys.some(k => specialKeys.includes(k))) {
          throwInvalidArrayInitializer(s, arg);
        }
        for (const key of keys) {
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
                dv = getDataViewFromUTF8(arg[key], elementSize);
                dup = false;
                break;
              case 'base64':
                dv = getDataViewFromBase64(arg[key]);
                dup = false;
                break;
            }
            checkDataViewSize(s, dv);
            const length = dv.byteLength / elementSize;
            if (dup) {
              shapeDefiner.call(this, null, length);
              copy(this[MEMORY], dv);
            } else {
              // reuse memory from string decoding
              shapeDefiner.call(this, dv, length);
            }
            shapeless = false;
          } else {
            this[key] = arg[key];
          }
        }
      } else {
        throwInvalidArrayInitializer(s, arg);
      }
    }
  };
  const retriever = function() { return this };
  const pointerCopier = s.pointerCopier = (hasPointer) ? getPointerCopier(objectMember) : null;
  const pointerResetter = s.pointerResetter = (hasPointer) ? getPointerResetter(objectMember) : null;
  const pointerDisabler = s.pointerDisabler = (hasPointer) ? getPointerDisabler(objectMember) : null;
  const { get, set } = getAccessors(member, options);
  const getLength = function() { return this[LENGTH] };
  Object.defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    length: { get: getLength, configurable: true },
    $: { get: retriever, set: initializer, configurable: true },
    [Symbol.iterator]: { value: getArrayIterator, configurable: true },
  });
  Object.defineProperties(constructor, {
    child: { get: () => elementStructure.constructor },
    [COMPAT]: { value: getCompatibleTags(member) },
  });
  addSpecialAccessors(s);
  return constructor;
}
