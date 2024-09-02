import { mixin } from '../environment.js';
import { InvalidInitializer, NotOnByteBoundary } from '../errors.js';
import {
  getStructEntries, getStructIterator, getVectorEntries, getVectorEntriesIterator, getZigIterator
} from '../iterators.js';
import { MemberType } from '../members/all.js';
import { getSelf } from '../object.js';
import { always, copyPointer } from '../pointer.js';
import {
  ALIGN, COPIER, ENTRIES,
  MEMORY, PARENT,
  PROPS, SIZE, SLOTS, TUPLE, TYPE,
  VISITOR,
  VIVIFICATOR
} from '../symbols.js';
import { StructureType } from './all.js';

export default mixin({
  defineStruct(structure) {
    const {
      byteSize,
      align,
      instance: { members },
      isTuple,
      isIterator,
      hasPointer,
    } = structure;
    const memberDescriptors = {};
    const fieldMembers = members.filter(m => !!m.name);
    const backingIntMember = members.find(m => !m.name);
    for (const member of fieldMembers) {
      const { get, set } = this.getDescriptor(member);
      memberDescriptors[member.name] = { get, set, configurable: true, enumerable: true };
      if (member.isRequired && set) {
        set.required = true;
      }
    }
    const backingInt = (backingIntMember) ? this.getDescriptor(backingIntMember) : null;
    const hasObject = !!members.find(m => m.type === MemberType.Object);
    const propApplier = this.createPropertyApplier(structure);
    const initializer = function(arg) {
      if (arg instanceof constructor) {
        this[COPIER](arg);
        if (hasPointer) {
          this[VISITOR](copyPointer, { vivificate: true, source: arg });
        }
      } else if (arg && typeof(arg) === 'object') {
        propApplier.call(this, arg);
      } else if ((typeof(arg) === 'number' || typeof(arg) === 'bigint') && backingInt) {
        backingInt.set.call(this, arg);
      } else if (arg !== undefined) {
        throw new InvalidInitializer(structure, 'object', arg);
      }
    };
    const constructor = structure.constructor = this.createConstructor(structure, { initializer });
    const toPrimitive = (backingInt)
    ? function(hint) {
      switch (hint) {
        case 'string':
          return Object.prototype.toString.call(this);
        default:
          return backingInt.get.call(this);
      }
    }
    : null;
    const length = (isTuple && members.length > 0)
    ? parseInt(members[members.length - 1].name) + 1
    : 0;
    const getIterator = (isIterator)
    ? getZigIterator
    : (isTuple)
      ? getVectorEntriesIterator
      : getStructIterator;
    const instanceDescriptors = {
      $: { get: getSelf, set: initializer },
      length: isTuple && { value: length },
      entries: isTuple && { value: getVectorEntries },
      ...memberDescriptors,
      [Symbol.iterator]: { value: getIterator },
      [Symbol.toPrimitive]: backingInt && { value: toPrimitive },
      [ENTRIES]: { get: isTuple ? getVectorEntries : getStructEntries },
      [VIVIFICATOR]: hasObject && { value: getChildVivificator(structure, this, true) },
      [VISITOR]: hasPointer && { value: getPointerVisitor(structure, always) },
      [PROPS]: { value: fieldMembers.map(m => m.name) },
    };
    const staticDescriptors = {
      [ALIGN]: { value: align },
      [SIZE]: { value: byteSize },
      [TYPE]: { value: structure.type },
      [TUPLE]: { value: isTuple },
    };
    return this.attachDescriptors(structure, instanceDescriptors, staticDescriptors);
  }
});

export function isNeededByStructure(structure) {
  switch (structure.type) {
    case StructureType.ExternStruct:
    case StructureType.Struct:
      return true;
    default:
      return false;
  }
}

export function getChildVivificator(structure, env) {
  const { instance: { members } } = structure;
  const objectMembers = {};
  for (const member of members.filter(m => m.type === MemberType.Object)) {
    objectMembers[member.slot] = member;
  }
  return function vivificateChild(slot) {
    const member = objectMembers[slot];
    const { bitOffset, byteSize, structure: { constructor } } = member;
    const dv = this[MEMORY];
    const parentOffset = dv.byteOffset;
    const offset = parentOffset + (bitOffset >> 3);
    let len = byteSize;
    if (len === undefined) {
      if (bitOffset & 7) {
        throw new NotOnByteBoundary(member);
      }
      len = member.bitSize >> 3;
    }
    const childDV = env.obtainView(dv.buffer, offset, len);
    const object = this[SLOTS][slot] = constructor.call(PARENT, childDV);
    return object;
  }
}

export function getPointerVisitor(structure, visitorOptions = {}) {
  const {
    isChildActive = always,
    isChildMutable = always,
  } = visitorOptions;
  const { instance: { members } } = structure;
  const pointerMembers = members.filter(m => m.structure?.hasPointer);
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
