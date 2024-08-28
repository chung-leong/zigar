import { mixin } from '../class.js';

mixin({
  getFloatDescriptor(member, env) {
    return this.getDescriptorUsing(member, env, this.getNumericAccessor);
  },
});

