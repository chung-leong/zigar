import { getCompatibleTags } from './data-view.js';
import { throwAccessingOpaque, throwCreatingOpaque } from './error.js';
import { getDestructor } from './memory.js';
import { attachDescriptors } from './structure.js';
import { ALIGN, COMPAT, ENVIRONMENT, MEMORY, SIZE } from './symbol.js';

export function defineOpaque(structure, env) {
  const constructor = structure.constructor = function(arg) {
    if (this == ENVIRONMENT) {
      const self = Object.create(constructor.prototype);
      self[MEMORY] = arg;
    } else {
      throwCreatingOpaque();
    }
  };
  const instanceDescriptors = {
    $: { get: throwAccessingOpaque, set: throwAccessingOpaque },
    valueOf: { value: throwAccessingOpaque },
    toJSON: { value: throwAccessingOpaque },
    delete: { value: getDestructor(env) },
    [Symbol.toPrimitive]: { value: throwAccessingOpaque },
  };
  const staticDescriptors = {
    [COMPAT]: { value: getCompatibleTags(structure) },
    [ALIGN]: { value: 0 },
    [SIZE]: { value: 0 },
  };
  return attachDescriptors(constructor, instanceDescriptors, staticDescriptors);
};
