import { ProxyType } from '../constants.js';
import { mixin } from '../environment.js';
import { getProxy } from '../proxies.js';
import { MEMORY, PARENT, RESTORE, SLOTS } from '../symbols.js';
import { defineProperties } from '../utils.js';

export default mixin({
  defineFinalizerArray({ get, set }) {
    return {
      value(proxying) {
        defineProperties(this, {
          get: { value: get.bind(this) },
          set: set && { value: set.bind(this) },
        });
        return (proxying) ? getProxy(this, ProxyType.Array) : this;
      },
    };
  },
  defineVivificatorArray(structure) {
    const { instance: { members: [ member ]} } = structure;
    const { byteSize, structure: elementStructure } = member;
    const thisEnv = this;
    const value = function getChild(index) {
      const { constructor } = elementStructure;
      const dv = (process.env.TARGET === 'wasm') ? this[RESTORE]() : this[MEMORY];
      const parentOffset = dv.byteOffset;
      const offset = parentOffset + byteSize * index;
      const childDV = thisEnv.obtainView(dv.buffer, offset, byteSize);
      const object = this[SLOTS][index] = constructor.call(PARENT, childDV);
      return object;
    };
    return { value };
  },
});

