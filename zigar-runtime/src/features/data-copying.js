import { mixin } from '../environment.js';
import { MEMORY, RESTORER } from '../symbols.js';

export default mixin({
  getCopierDescriptor(size, multiple) {
    const copy = getCopyFunction(size, multiple);
    const value = function(target) {
      if (process.env.TARGET === 'wasm') {
        this[RESTORER]?.();
        target[RESTORER]?.();
      }
      const src = target[MEMORY];
      const dest = this[MEMORY];
      copy(dest, src);
    };
    return { value };
  },
  getResetterDescriptor(offset, size) {
    const reset = getResetFunction(size);
    const value = function() {
      if (process.env.TARGET === 'wasm') {
        this[RESTORER]?.();
      }
      const dest = this[MEMORY];
      reset(dest, offset, size);
    };
    return { value };
  },
  ...(process.env.TARGET === 'wasm' ? {
    copyExternBytes(dst, address, len) {
      const { memory } = this;
      const src = new DataView(memory.buffer, address, len);
      const copy = getCopyFunction(len);
      copy(dst, src);
    },
  } : process.env.TARGET === 'node' ? {
    imports: {
      copyExternBytes: null,
    },
  } : undefined),
});

export function isNeededByStructure(structure) {
  return true;
}

export function getCopyFunction(size, multiple = false) {
  if (size !== undefined) {
    if (!multiple) {
      const copier = copiers[size];
      if (copier) {
        return copier;
      }
    }
    if (!(size & 0x07)) return copy8x;
    if (!(size & 0x03)) return copy4x;
    if (!(size & 0x01)) return copy2x;
    return copy1x;
  } else {
    return copyAny;
  }
}

function copyAny(dest, src) {
  const copy = getCopyFunction(dest.byteLength);
  copy(dest, src);
}

const copiers = {
  1: copy1,
  2: copy2,
  4: copy4,
  8: copy8,
  16: copy16,
  32: copy32,
};

function copy1x(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i++) {
    dest.setInt8(i, src.getInt8(i));
  }
}

function copy2x(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 2) {
    dest.setInt16(i, src.getInt16(i, true), true);
  }
}

function copy4x(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 4) {
    dest.setInt32(i, src.getInt32(i, true), true);
  }
}

function copy8x(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 8) {
    dest.setInt32(i, src.getInt32(i, true), true);
    dest.setInt32(i + 4, src.getInt32(i + 4, true), true);
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

function copy32(dest, src) {
  dest.setInt32(0, src.getInt32(0, true), true);
  dest.setInt32(4, src.getInt32(4, true), true);
  dest.setInt32(8, src.getInt32(8, true), true);
  dest.setInt32(12, src.getInt32(12, true), true);
  dest.setInt32(16, src.getInt32(16, true), true);
  dest.setInt32(20, src.getInt32(20, true), true);
  dest.setInt32(24, src.getInt32(24, true), true);
  dest.setInt32(28, src.getInt32(28, true), true);
}

export function getResetFunction(size) {
  const resetter = resetters[size];
  if (resetter) {
    return resetter;
  }
  if (!(size & 0x07)) return reset8x;
  if (!(size & 0x03)) return reset4x;
  if (!(size & 0x01)) return reset2x;
  return reset1x;
}

const resetters = {
  1: reset1,
  2: reset2,
  4: reset4,
  8: reset8,
  16: reset16,
  32: reset32,
};

function reset1x(dest, offset, size) {
  for (let i = offset, limit = offset + size; i < limit; i++) {
    dest.setInt8(i, 0);
  }
}

function reset2x(dest, offset, size) {
  for (let i = offset, limit = offset + size; i < limit; i += 2) {
    dest.setInt16(i, 0, true);
  }
}

function reset4x(dest, offset, size) {
  for (let i = offset, limit = offset + size; i < limit; i += 4) {
    dest.setInt32(i, 0, true);
  }
}

function reset8x(dest, offset, size) {
  for (let i = offset, limit = offset + size; i < limit; i += 8) {
    dest.setInt32(i, 0, true);
    dest.setInt32(i + 4, 0, true);
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

function reset32(dest, offset) {
  dest.setInt32(offset + 0, 0, true);
  dest.setInt32(offset + 4, 0, true);
  dest.setInt32(offset + 8, 0, true);
  dest.setInt32(offset + 12, 0, true);
  dest.setInt32(offset + 16, 0, true);
  dest.setInt32(offset + 20, 0, true);
  dest.setInt32(offset + 24, 0, true);
  dest.setInt32(offset + 28, 0, true);
}
