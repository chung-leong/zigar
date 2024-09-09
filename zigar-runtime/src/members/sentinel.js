import { MemberFlag, StructureFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { MisplacedSentinel, MissingSentinel } from '../errors.js';
import { MEMORY } from '../symbols.js';
import { defineValue } from '../utils.js';

export default mixin({
  defineSentinel(structure) {
    const {
      byteSize,
      instance: { members: [ member, sentinel ], template },
    } = structure;
    /* c8 ignore start */
    if (process.env.DEV) {
      if (sentinel.bitOffset === undefined) {
        throw new Error(`bitOffset must be 0 for sentinel member`);
      }
    }
    /* c8 ignore end */
    const { get: getSentinelValue } = this.defineMember(sentinel);
    const { get } = this.defineMember(member);
    const value = getSentinelValue.call(template, 0);
    const isRequired = !!(sentinel.flags & MemberFlag.IsRequired);
    return defineValue({
      value,
      bytes: template[MEMORY],
      validateValue(v, i, l) {
        if (isRequired) {
          if (this.runtimeSafety && v === value && i !== l - 1) {
            throw new MisplacedSentinel(structure, v, i, l);
          }
          if (v !== value && i === l - 1) {
            throw new MissingSentinel(structure, value, l);
          }
        }
      },
      validateData(source, len) {
        if (isRequired) {
          if (this.runtimeSafety) {
            for (let i = 0; i < len; i++) {
              const v = get.call(source, i);
              if (v === value && i !== len - 1) {
                throw new MisplacedSentinel(structure, value, i, len);
              } else if (v !== value && i === len - 1) {
                throw new MissingSentinel(structure, value, len);
              }
            }
          } else {
            // if the length doesn't match, let the operation fail elsewhere
            if (len * byteSize === source[MEMORY].byteLength) {
              const v = get.call(source, len - 1);
              if (v !== value) {
                throw new MissingSentinel(structure, value, len);
              }
            }
          }
        }
      },
      isRequired,
    });
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
  return !!(structure.flags & StructureFlag.HasSentinel);
}
