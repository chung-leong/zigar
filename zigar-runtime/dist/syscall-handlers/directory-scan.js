import { PosixError, PosixFileType, RootDescriptor } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, InvalidEnumValue } from '../errors.js';
import { encodeText, decodeEnum } from '../utils.js';

var directoryScan = mixin({
  init() {
    {
      this.readdirCookieMap = new Map();
      this.readdirNextCookie = 1n;
    }
  },
  fdReaddir(fd, buf_address, buf_len, cookie, bufused_address, canWait) {
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
        cookie = this.readdirNextCookie++;
        this.readdirCookieMap.set(cookie, context);
      } else {
        context = this.readdirCookieMap.get(cookie);
      }
      let dv = new DataView(this.memory.buffer);
      let remaining = buf_len;
      let p = buf_address;
      let used;
      const defaultEntryCount = (fd !== RootDescriptor) ? 2 : 1;
      if (context) {
        let { iterator, entry } = context;
        if (entry) {
          context.entry = null;
        }
        while (remaining >= 24) {
          if (!entry) {
            if (++context.count <= defaultEntryCount) {
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
          if (remaining < 24 + array.length) {
            context.entry = entry;
            break;
          }
          const typeIndex = (type !== undefined) ? decodeEnum(type, PosixFileType) : PosixFileType.unknown;
          if (typeIndex === undefined) {
            throw new InvalidEnumValue(PosixFileType, type);
          }
          dv.setBigUint64(p, cookie, true);
          dv.setBigUint64(p + 8, BigInt(ino), true);
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
        this.readdirCookieMap.delete(cookie);
      }
    })
  },
});

export { directoryScan as default };
