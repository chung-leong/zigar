import { getCompatibleTags, getTypedArrayClass } from '../../data-view.js';
import { InvalidInitializer } from '../../error.js';
import { getMemoryCopier } from '../../memory.js';
import { makeReadOnly } from '../../object.js';
import {
  convertToJSON, getBase64Descriptor, getDataViewDescriptor, getTypedArrayDescriptor, getValueOf
} from '../../special.js';
import {
  ALIGN, BIT_SIZE, COMPAT, COPIER, PRIMITIVE, SIZE, TYPE, WRITE_DISABLER,
} from '../../symbol.js';
import { getPrimitiveType, StructureType } from '../../types.js';
import { mixin } from '../class.js';

mixin({
  definePrimitive(structure) {
    const {
      byteSize,
      align,
      instance: { members: [ member ] },
    } = structure;
    const { get, set } = this.getDescriptor(member);
    const propApplier = this.createPropertyApplier(structure);
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
    const constructor = structure.constructor = this.createConstructor(structure, { initializer });
    const typedArray = structure.typedArray = getTypedArrayClass(member);
    const instanceDescriptors = {
      $: { get, set },
      dataView: getDataViewDescriptor(structure),
      base64: getBase64Descriptor(structure),
      typedArray: typedArray && getTypedArrayDescriptor(structure),
      valueOf: { value: getValueOf },
      toJSON: { value: convertToJSON },
      delete: { value: this.getDestructor(env) },
      [Symbol.toPrimitive]: { value: get },
      [COPIER]: { value: getMemoryCopier(byteSize) },
      [WRITE_DISABLER]: { value: makeReadOnly },
    };
    const staticDescriptors = {
      [COMPAT]: { value: getCompatibleTags(structure) },
      [ALIGN]: { value: align },
      [SIZE]: { value: byteSize },
      [BIT_SIZE]: { value: member.bitSize },
      [TYPE]: { value: structure.type },
      [PRIMITIVE]: { value: member.type },
    };
    return this.attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
  }
});

export function isRequiredByStructure(structure) {
  return structure.type === StructureType.Primitive;
}
