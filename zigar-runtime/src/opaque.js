import { getCompatibleTags } from './data-view.js';
import { throwAccessingOpaque, throwCreatingOpaque } from './error.js';
import { getDestructor } from './memory.js';
import { attachDescriptors, createConstructor } from './structure.js';
import { ALIGN, COMPAT, SIZE } from './symbol.js';

export function defineOpaque(structure, env) {
  const {
    byteSize,
    align,
  } = structure;
  const initializer = function() {
    throwCreatingOpaque(structure);
  };
  const valueAccessor = function() {
    throwAccessingOpaque(structure);
  };
  const constructor = structure.constructor = createConstructor(structure, { initializer }, env);
  const instanceDescriptors = {
    $: { get: valueAccessor, set: valueAccessor },
    valueOf: { value: valueAccessor },
    toJSON: { value: valueAccessor },
    delete: { value: getDestructor(env) },
    [Symbol.toPrimitive]: { value: valueAccessor },
  };
  const staticDescriptors = {
    [COMPAT]: { value: getCompatibleTags(structure) },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
};
