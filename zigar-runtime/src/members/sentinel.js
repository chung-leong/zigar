import { mixin } from '../environment.js';
import { MisplacedSentinel, MissingSentinel } from '../errors.js';
import { StructureType } from '../structures/all.js';
import { MEMORY } from '../symbols.js';

export default mixin({
  getSentinel(structure) {
    const {
      byteSize,
      instance: { members: [ member, sentinel ], template },
    } = structure;
    if (!sentinel) {
      return;
    }
    /* c8 ignore start */
    if (process.env.DEV) {
      if (sentinel.bitOffset === undefined) {
        throw new Error(`bitOffset must be 0 for sentinel member`);
      }
    }
    /* c8 ignore end */
    const { get: getSentinelValue } = this.getDescriptor(sentinel);
    const value = getSentinelValue.call(template, 0);
    const { get } = this.getDescriptor(member);
    const { isRequired } = sentinel;
    const validateValue = (isRequired)
    ? (this.runtimeSafety)
      ? function(v, i, l) {
        if (v === value && i !== l - 1) {
          throw new MisplacedSentinel(structure, v, i, l);
        } else if (v !== value && i === l - 1) {
          throw new MissingSentinel(structure, value, i, l);
        }
      } : function(v, i, l) {
        if (v !== value && i === l - 1) {
          throw new MissingSentinel(structure, value, l);
        }
      }
    : function() {};
    const validateData = (isRequired)
    ? (this.runtimeSafety)
      ? function(source, len) {
          for (let i = 0; i < len; i++) {
            const v = get.call(source, i);
            if (v === value && i !== len - 1) {
              throw new MisplacedSentinel(structure, value, i, len);
            } else if (v !== value && i === len - 1) {
              throw new MissingSentinel(structure, value, len);
            }
          }
        }
      : function(source, len) {
          if (len * byteSize === source[MEMORY].byteLength) {
            const i = len - 1;
            const v = get.call(source, i);
            if (v !== value) {
              throw new MissingSentinel(structure, value, len);
            }
          }
      }
    : function () {};
    const bytes = template[MEMORY];
    return { value, bytes, validateValue, validateData, isRequired };
  },
  ...(process.env.target === 'wasm' ? {
    findSentinel(address, bytes) {
      const { memory } = this;
      const len = bytes.byteLength;
      const end = memory.buffer.byteLength - len + 1;
      for (let i = address; i < end; i += len) {
        const dv = new DataView(memory.buffer, i, len);
        let match = true;
        for (let j = 0; j < len; j++) {
          const a = dv.getUint8(j);
          const b = bytes.getUint8(j);
          if (a !== b) {
            match = false;
            break;
          }
        }
        if (match) {
          return (i - address) / len;
        }
      }
    },
  } : process.env.target === 'node' ? {
    imports: {
      findSentinel: null,
    },
  } : {}),
});

export function isNeededByStructure(structure) {
  if (structure.type === StructureType.Slice) {
    return !!this.getSentinel(structure);
  }
  return false;
}
