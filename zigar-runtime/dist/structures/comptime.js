import { mixin } from '../environment.js';
import { throwReadOnly } from '../errors.js';
import { BIT_SIZE, INITIALIZE } from '../symbols.js';
import { defineValue } from '../utils.js';

var comptime = mixin({
  defineComptime(structure, descriptors) {
    const {
      instance: { members: [ member ] },
    } = structure;
    const { get } = this.defineMember(member);
    const constructor = this.createConstructor(structure);
    descriptors.$ = { get, set: throwReadOnly };
    descriptors[INITIALIZE] = defineValue(throwReadOnly);
    descriptors[Symbol.toPrimitive] = defineValue(get);
    return constructor;
  },
  finalizeComptime(structure, staticDescriptors) {
    const {
      instance: { members: [ member ] },
    } = structure;
    staticDescriptors[BIT_SIZE] = defineValue(member.bitSize);
  },
});

export { comptime as default };
