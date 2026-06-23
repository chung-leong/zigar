import { PosixDescriptor, PosixDescriptorFlag, PosixDescriptorRight, PosixError } from '../constants.js';
import { mixin } from '../environment.js';
import { catchPosixError, checkAccessRight, checkStreamMethod } from '../errors.js';
import { createView, isPromise, safeInt } from '../utils.js';

function isVirtual(fd) {
  return (fd <= 2 || fd >= PosixDescriptor.min);
}

export default (process.env.TARGET === 'node') ? mixin({
  fdCopyFileRange(inFd, inOffsetAddress, outFd, outOffsetAddress, len, copiedAddress, canWait) {
    let inPos = (inOffsetAddress) ? this.getOffsetAt(inOffsetAddress) : 0n;
    let outPos = (outOffsetAddress) ? this.getOffsetAt(outOffsetAddress) : 0n;
    let copied = 0n;
    return catchPosixError(canWait, PosixError.EBADF, () => {
      let read, write;
      if (isVirtual(inFd)) {
        const[ reader, rights ] = this.getStream(inFd);
        checkAccessRight(rights, PosixDescriptorRight.fd_read);
        if (inOffsetAddress) {
          checkStreamMethod(reader, 'pread', PosixError.EINVAL);
          read = (len, offset) => reader.pread(len, safeInt(offset));
        } else {
          read = (len) => reader.read(len);
        }
      } else {
        if (inOffsetAddress) {
          read = (len, offset) => this.readFile(inFd, len, offset);
        } else {
          read = (len) => this.readFile(inFd, len);
        }
      }
      if (isVirtual(outFd)) {
        const[ writer, rights, flags ] = this.getStream(outFd);
        checkAccessRight(rights, PosixDescriptorRight.fd_write);
        if (outOffsetAddress) {
          write = (chunk, offset) => writer.pwrite(chunk, safeInt(offset));
        } else {
          const method = (flags & PosixDescriptorFlag.nonblock) ? writer.writenb : writer.write;
          write = (chunk) => method.call(writer, chunk);
        }    
      } else {
        if (outOffsetAddress) {
          write = (chunk, offset) => this.writeFile(outFd, chunk, offset);
        } else {
          write = (chunk) => this.writeFile(outFd, chunk);
        }
      }
      let written = 0n;
      const intake = () => {
        copied += written;
        inPos += written;
        outPos += written;
        if (copied === len) return copied;
        const chunkSize = Math.min(Number(len - copied), 1024 * 1024);
        const result = read(chunkSize, inPos);
        if (isPromise(result)) {
          return result.then(discharge);
        } else {          
          return discharge(result);
        }
      };
      const discharge = (chunk) => {
        written = BigInt(chunk.length);
        if (written === 0n) return;
        const result = write(chunk, outPos);
        if (isPromise(result)) {
          return result.then(intake);
        } else {
          return intake();
        }
      };
      return intake();
    }, () => {
      if (inOffsetAddress) {
        this.copyUint64(inOffsetAddress, inPos);
      }
      if (outOffsetAddress) {
        this.copyUint64(outOffsetAddress, outPos);
      }
      this.copyUint64(copiedAddress, copied);
    });
  },
  getOffsetAt(address) {
    const dv = createView(8);
    this.moveExternBytes(dv, address, false);
    return dv.getBigUint64(0, this.littleEndian);
  },
  imports: {
    readFile: {},
    writeFile: {},
  },
  exports: {
    fdCopyFileRange: { async: true },
  },
}) : undefined;
