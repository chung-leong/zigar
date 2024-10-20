import { mixin } from '../environment.js';
import { MEMORY, RESTORE } from '../symbols.js';

export default mixin({
  defineCopier(size, multiple) {
    const copy = getCopyFunction(size, multiple);
    return {
      value(target) {
        if (process.env.TARGET === 'wasm') {
          this[RESTORE]?.();
          target[RESTORE]?.();
        }
        const src = target[MEMORY];
        const dest = this[MEMORY];
        copy(dest, src);
      },
    };
  },
  defineResetter(offset, size) {
    const reset = getResetFunction(size);
    return {
      value() {
        if (process.env.TARGET === 'wasm') {
          this[RESTORE]?.();
        }
        const dest = this[MEMORY];
        reset(dest, offset, size);
      }
    };
  },
  getCopyFunction,
});

export function getCopyFunction(size, multiple = false) {
  if (size !== undefined) {
    if (!multiple) {
      const copier = copiers[size];
      if (copier) {
        return copier;
      }
    }
    if (!(size & 0x03)) return copy4x;
  }
  return copyAny;
}

function copyAny(dest, src) {
  let i = 0, len = dest.byteLength;
  while (i + 4 <= len) {
    dest.setInt32(i, src.getInt32(i, true), true);
    i += 4;
  }
  while (i + 1 <= len) {
    dest.setInt8(i, src.getInt8(i));
    i++;
  }
}

const copiers = {
  1: copy1,
  2: copy2,
  4: copy4,
  8: copy8,
  16: copy16,
};

function copy4x(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 4) {
    dest.setInt32(i, src.getInt32(i, true), true);
  }
}

function copy1(dest, src) {
  dest.setInt8(0, src.getInt8(0));
}

function copy2(dest, src) {
  dest.setInt16(0, src.getInt16(0, true), true);
}

function copy4(dest, src) {
  dest.setInt32(0, src.getInt32(0, true), true);
}

function copy8(dest, src) {
  dest.setInt32(0, src.getInt32(0, true), true);
  dest.setInt32(4, src.getInt32(4, true), true);
}

function copy16(dest, src) {
  dest.setInt32(0, src.getInt32(0, true), true);
  dest.setInt32(4, src.getInt32(4, true), true);
  dest.setInt32(8, src.getInt32(8, true), true);
  dest.setInt32(12, src.getInt32(12, true), true);
}

export function getResetFunction(size) {
  if (size !== undefined) {
    const resetter = resetters[size];
    if (resetter) {
      return resetter;
    }
    if (!(size & 0x03)) return reset4x;
  }
  return resetAny;
}

const resetters = {
  1: reset1,
  2: reset2,
  4: reset4,
  8: reset8,
  16: reset16,
};

function resetAny(dest, offset, size) {
  let i = offset, limit = offset + size;
  while (i + 4 <= limit) {
    dest.setInt32(i, 0, true);
    i += 4;
  }
  while (i + 1 <= limit) {
    dest.setInt8(i, 0);
    i++;
  }
}

function reset4x(dest, offset, size) {
  for (let i = offset, limit = offset + size; i < limit; i += 4) {
    dest.setInt32(i, 0, true);
  }
}

function reset1(dest, offset) {
  dest.setInt8(offset, 0);
}

function reset2(dest, offset) {
  dest.setInt16(offset, 0, true);
}

function reset4(dest, offset) {
  dest.setInt32(offset, 0, true);
}

function reset8(dest, offset) {
  dest.setInt32(offset + 0, 0, true);
  dest.setInt32(offset + 4, 0, true);
}

function reset16(dest, offset) {
  dest.setInt32(offset + 0, 0, true);
  dest.setInt32(offset + 4, 0, true);
  dest.setInt32(offset + 8, 0, true);
  dest.setInt32(offset + 12, 0, true);
}

