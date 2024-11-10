import { MemberFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { MisplacedSentinel, MissingSentinel } from '../errors.js';
import { MEMORY } from '../symbols.js';
import { defineValue } from '../utils.js';

var sentinel = mixin({
  defineSentinel(structure) {
    const {
      byteSize,
      instance: { members: [ member, sentinel ], template },
    } = structure;
    /* c8 ignore end */
    const { get: getSentinelValue } = this.defineMember(sentinel);
    const { get } = this.defineMember(member);
    const value = getSentinelValue.call(template, 0);
    const isRequired = !!(sentinel.flags & MemberFlag.IsRequired);
    const { runtimeSafety } = this;
    return defineValue({
      value,
      bytes: template[MEMORY],
      validateValue(v, i, l) {
        if (isRequired) {
          if (runtimeSafety && v === value && i !== l - 1) {
            throw new MisplacedSentinel(structure, v, i, l);
          }
          if (v !== value && i === l - 1) {
            throw new MissingSentinel(structure, value, l);
          }
        }
      },
      validateData(source, len) {
        if (isRequired) {
          if (runtimeSafety) {
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
            if (len > 0 && len * byteSize === source[MEMORY].byteLength) {
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
  ...({
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
  } ),
});

export { sentinel as default };
