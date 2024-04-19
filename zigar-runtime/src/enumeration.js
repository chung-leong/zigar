import { getDataView, getTypedArrayClass } from './data-view.js';
import { InvalidInitializer } from './error.js';
import { getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { attachDescriptors, createConstructor, createPropertyApplier, defineProperties, makeReadOnly } from './object.js';
import { convertToJSON, getBase64Descriptor, getDataViewDescriptor, getTypedArrayDescriptor, getValueOf } from './special.js';
import { ALIGN, COPIER, MORE, NAME, NORMALIZER, SIZE, TAG } from './symbol.js';

export function defineEnumerationShape(structure, env) {
  const {
    byteSize,
    align,
    instance: {
      members: [ member ],
    },
  } = structure;
  const { get, set } = getDescriptor(member, env);
  const expected = [ 'string', 'number', 'tagged union' ];
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg && typeof(arg) === 'object') {
      if (propApplier.call(this, arg) === 0) {
        throw new InvalidInitializer(structure, expected, arg);
      }
    } else if (arg !== undefined) {
      set.call(this, arg);
    }
  };
  const alternateCaster = function(arg) {
    if (typeof(arg)  === 'string' || typeof(arg) === 'number' || typeof(arg) === 'bigint') {
      let item = constructor[arg];
      if (!item) {
        if (constructor[MORE] && typeof(arg) !== 'string') {
          // create the item on-the-fly when enum is non-exhaustive
          item = new constructor(undefined);
          debugger;        
          set.call(item, arg, 'number');
          appendEnumeration(constructor, `${arg}`, item);
        }
      }
      return item;
    } else if (arg instanceof constructor) {
      return arg;
    } else if (arg?.[TAG] instanceof constructor) {
      // a tagged union, return the active tag
      return arg[TAG];
    } else if (!getDataView(structure, arg, env)) {
      throw new InvalidInitializer(structure, expected, arg);
    } else {
      return false;
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer, alternateCaster }, env);
  const typedArray = structure.typedArray = getTypedArrayClass(member);
  const toPrimitive = function(hint) {
    switch (hint) {
      case 'string':
      case 'default':
        return this.$[NAME];
      default:
        return get.call(this, 'number');
    }
  };
  const instanceDescriptors = {
    $: { get, set },
    dataView: getDataViewDescriptor(structure),
    base64: getBase64Descriptor(structure),
    typedArray: typedArray && getTypedArrayDescriptor(structure),
    valueOf: { value: getValueOf },
    toString: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    [Symbol.toPrimitive]: { value: toPrimitive },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [NORMALIZER]: { value: normalizeEnumerationItem },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
};

export function normalizeEnumerationItem(cb) {
  return cb(this.$[NAME]);
}

export function appendEnumeration(enumeration, name, item) {
  if (name !== undefined) {
    // enum can have static variables 
    if (item instanceof enumeration) {
      // attach name to item so tagged union code can quickly find it
      defineProperties(item, { [NAME]: { value: name } });  
      // call toPrimitive directly since enum can be bigint or number
      const index = item[Symbol.toPrimitive]();
      defineProperties(enumeration, {
        [index]: { value: item },
        [name]: { value: item },
      });
      makeReadOnly(item);
    }
  } else {
    // non-exhaustive enum
    defineProperties(enumeration, { [MORE]: { value: true } });
  }
}