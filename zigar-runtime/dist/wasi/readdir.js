import { PosixError, PosixFileType } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError } from '../errors.js';
import { encodeText } from '../utils.js';

var readdir = mixin({
  init() {
    this.wasiCookieMap = new Map();
    this.wasiNextCookie = 1n;
  },
  wasi_fd_readdir(fd, buf_address, buf_len, cookie, bufused_address, canWait) {
    if (buf_len < 24) {
      return PosixError.EINVAL;
    }
    return catchPosixError(canWait, PosixError.EBADF, () => {
      if (cookie === 0n) {
        return this.getDirectoryEntries(fd);
      }
    }, (generator) => {
      let context;
      if (cookie === 0n) {
        const iterator = generator[Symbol.iterator]();
        context = { iterator, count: 0, entry: null };
        cookie = this.wasiNextCookie++;
        this.wasiCookieMap.set(cookie, context);
      } else {
        context = this.wasiCookieMap.get(cookie);
      }
      let dv = new DataView(this.memory.buffer);
      let remaining = buf_len;
      let p = buf_address;
      let used;
      if (context) {
        let { iterator, entry } = context;
        if (entry) {
          context.entry = null;
        }
        const typeKeys = Object.keys(PosixFileType);
        while (remaining >= 24) {
          if (!entry) {
            if (++context.count <= 2) {
              entry = { 
                value: { name: '.'.repeat(context.count), type: 'directory' },
                done: false,
              };
            } else {
              entry = iterator.next();
            }
          }
          const { value, done } = entry;
          if (done) {
            break;
          }
          const { name, type, ino = 0 } = value;
          const array = encodeText(name);
          let typeIndex = typeKeys.indexOf(type);
          if (typeIndex === -1) {
            if (type !== undefined) {
              throw new TypeMismatch(typeKeys.map(k => `'${k}'`).join(', '), type);
            }
            typeIndex = PosixFileType.unknown;
          }
          if (remaining < 24 + array.length) {
            context.entry = entry;
            break;
          }
          dv.setBigUint64(p, cookie, true);
          dv.setBigUint64(p + 8, BigInt(ino ?? 0n), true);
          dv.setUint32(p + 16, array.length, true);
          dv.setUint8(p + 20, typeIndex);
          p += 24;
          remaining -= 24;
          for (let i = 0; i < array.length; i++, p++) {
            dv.setUint8(p, array[i]);
          }
          remaining -= array.length;
          entry = null;
        }
      }
      used = p - buf_address;
      dv.setUint32(bufused_address, used, true);
      if (used === 0) {
        this.wasiCookieMap.delete(cookie);
      }
    })
  }
});

export { readdir as default };
