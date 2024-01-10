import { throwInvalidInitializer } from './error.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { always, copyPointer } from './pointer.js';
import { convertToJSON, getBase64Accessors, getDataViewAccessors, getValueOf } from './special.js';
import { attachDescriptors, createConstructor, createPropertyApplier, getSelf } from './structure.js';
import { ALIGN, COPIER, MEMORY, NORMALIZER, PARENT, SIZE, SLOTS, VISITOR, VIVIFICATOR } from './symbol.js';

export function defineStructShape(structure, env) {
  const {
    byteSize,
    align,
    instance: { members },
    hasPointer,
  } = structure;  
  const memberDescriptors = {};
  for (const member of members) {
    const { get, set } = getDescriptor(member, env);
    memberDescriptors[member.name] = { get, set, configurable: true, enumerable: true };
    if (member.isRequired) {
      set.required = true;
    }
  }
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[COPIER](arg);
      if (hasPointer) {
        this[VISITOR](copyPointer, { vivificate: true, source: arg });
      }
    } else if (arg && typeof(arg) === 'object') {
      propApplier.call(this, arg);
    } else if (arg !== undefined) {
      throwInvalidInitializer(structure, 'object', arg);
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer }, env);
  const memberNames = members.map(m => m.name);
  const interatorCreator = function() {
    const self = this;
    let index = 0;
    return {
      next() {
        let value, done;
        if (index < memberNames.length) {
          const name = memberNames[index];
          value = [ name, self[name] ];
          done = false;
          index++;
        } else {
          done = true;
        }
        return { value, done };
      },
    };
  };
  const instanceDescriptors = {
    $: { get: getSelf, set: initializer },
    dataView: getDataViewAccessors(structure),
    base64: getBase64Accessors(structure),
    valueOf: { value: getValueOf },
    toJSON: { value: convertToJSON },
    delete: { value: getDestructor(env) },
    ...memberDescriptors,
    [Symbol.iterator]: { value: interatorCreator },
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator(structure, true) },
    [VISITOR]: hasPointer && { value: getPointerVisitor(structure, always) },
    [NORMALIZER]: { value: normalizeStruct },
  };
  const staticDescriptors = {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
}

export function normalizeStruct(map, forJSON) {
  let object = map.get(this);
  if (!object) {
    object = {};
    map.set(this, object);
    for (const [ name, value ] of this) {      
      object[name] = value[NORMALIZER]?.(map, forJSON) ?? value;
    }
  }
  return object;
}

export function getChildVivificator(structure) {
  const { instance: { members } } = structure;
  const objectMembers = {};
  for (const member of members.filter(m => m.type === MemberType.Object)) {
    objectMembers[member.slot] = member;
  }
  return function vivificateChild(slot, writable = true) {
    const { bitOffset, byteSize, structure: { constructor } } = objectMembers[slot];
    const dv = this[MEMORY];
    const parentOffset = dv.byteOffset;
    const offset = parentOffset + (bitOffset >> 3);
    const childDV = new DataView(dv.buffer, offset, byteSize);
    const object = this[SLOTS][slot] = constructor.call(PARENT, childDV, { writable });
    return object;
  }
}

export function getPointerVisitor(structure, visitorOptions = {}) {
  const {
    isChildActive = always,
    isChildMutable = always,
  } = visitorOptions;
  const { instance: { members } } = structure;
  const pointerMembers = members.filter(m => m.structure.hasPointer);
  return function visitPointers(cb, options = {}) {
    const {
      source,
      vivificate = false,
      isActive = always,
      isMutable = always,
    } = options;
    const childOptions = {
      ...options,
      isActive: (object) => {
        // make sure parent object is active, then check whether the child is active
        return isActive(this) && isChildActive.call(this, object);
      },
      isMutable: (object) => {
        return isMutable(this) && isChildMutable.call(this, object);
      },
    };
    for (const { slot } of pointerMembers) {
      if (source) {
        // when src is a the struct's template, most slots will likely be empty,
        // since pointer fields aren't likely to have default values
        const srcChild = source[SLOTS]?.[slot];
        if (!srcChild) {
          continue;
        }
        childOptions.source = srcChild;
      }
      const child = this[SLOTS][slot] ?? (vivificate ? this[VIVIFICATOR](slot) : null);
      if (child) {
        child[VISITOR](cb, childOptions);
      }
    }
  };
}
