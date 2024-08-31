import { getTypedArrayClass } from './data-view.js';
import { InvalidInitializer } from './error.js';
import { getDescriptor } from './member.js';
import {
  attachDescriptors, createConstructor, createPropertyApplier
} from './object.js';
import {
  BIT_SIZE,
  COPIER, PRIMITIVE
} from './symbol.js';
import { getPrimitiveType } from './types.js';

export function definePrimitive(structure, env) {
  const {
    byteSize,
    instance: { members: [ member ] },
  } = structure;
  const { get, set } = getDescriptor(member, env);
  const propApplier = createPropertyApplier(structure);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[COPIER](arg);
    } else {
      if (arg && typeof(arg) === 'object') {
        if (propApplier.call(this, arg) === 0) {
          const type = getPrimitiveType(member);
          throw new InvalidInitializer(structure, type, arg);
        }
      } else if (arg !== undefined) {
        set.call(this, arg);
      }
    }
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer }, env);
  const instanceDescriptors = {
    $: { get, set },
    [Symbol.toPrimitive]: { value: get },
    [COPIER]: this.getCopierDescriptor(byteSize),
  };
  const staticDescriptors = {
    [BIT_SIZE]: { value: member.bitSize },
    [PRIMITIVE]: { value: member.type },
  };
  structure.TypedArray = getTypedArrayClass(member);
  return attachDescriptors(structure, instanceDescriptors, staticDescriptors, env);
};
