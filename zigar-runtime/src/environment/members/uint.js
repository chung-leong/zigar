import { mixin } from '../class.js';

mixin({
  getUintDescriptor(member, env) {
    let getAccessor = this.getNumericAccessor;
    if (this.runtimeSafety) {
      getAccessor = this.addRuntimeCheck(env, getNumericAccessor);
    }
    const descriptor = this.getDescriptorUsing(member, getAccessor);
    return this.transformDescriptor(descriptor, member);
  },
});

