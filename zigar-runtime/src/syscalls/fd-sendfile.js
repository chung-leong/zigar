import { PosixDescriptor, PosixDescriptorFlag, PosixDescriptorRight, PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkAccessRight, checkStreamMethod } from '../errors.js';
import { isPromise, safeInt } from '../utils.js';

function isVirtual(fd) {
  return (fd <= 2 || fd >= PosixDescriptor.min);
}

export default (process.env.TARGET === 'node') ? mixin({
  fdSendfile(outFd, inFd, offset, offsetAddress, len, sentAddress, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      let read, write;
      if (isVirtual(inFd)) {
        const[ reader, rights ] = this.getStream(inFd);
        checkAccessRight(rights, PosixDescriptorRight.fd_read);
        if (offsetAddress) {
          checkStreamMethod(reader, 'pread', PosixError.EINVAL);
          read = (len, offset) => reader.pread(len, safeInt(offset));
        } else {
          read = (len) => reader.read(len);
        }
      } else {
        if (offsetAddress) {
          read = (len, offset) => this.readFile(inFd, len, offset);
        } else {
          read = (len) => this.readFile(inFd, len);
        }
      }
      if (isVirtual(outFd)) {
        const[ writer, rights, flags ] = this.getStream(outFd);
        checkAccessRight(rights, PosixDescriptorRight.fd_write);
        const method = (flags & PosixDescriptorFlag.nonblock) ? writer.writenb : writer.write;
        write = (chunk) => method.call(writer, chunk);
      } else {
        write = (chunk) => this.writeFile(outFd, chunk);
      }
      let position = offset;
      let remaining = len;
      let copied = 0;
      let written = 0;
      const intake = () => {
        remaining -= written;
        copied += written;
        position += BigInt(written);
        if (remaining === 0) return copied;
        const chunkSize = Math.min(remaining, 1024 * 1024);
        const result = read(chunkSize, position);
        if (isPromise(result)) {
          return result.then(discharge);
        } else {          
          return discharge(result);
        }
      };
      const discharge = (chunk) => {
        const result = write(chunk);
        written = chunk.length;
        if (isPromise(result)) {
          return result.then(intake);
        } else {
          return intake();
        }
      };
      return intake();
    }, (copied) => {
      if (offsetAddress) {
        this.copyUint64(offsetAddress, offset + BigInt(copied));
      }
      this.copyUint32(sentAddress, copied);
    });
  },
  imports: {
    readFile: {},
    writeFile: {},
  },
  exports: {
    fdSendfile: { async: true },
  },
}) : undefined;
