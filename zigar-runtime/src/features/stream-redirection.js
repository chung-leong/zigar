import { PosixDescriptor, PosixDescriptorRight } from '../constants.js';
import { mixin } from '../environment.js';
import { InvalidFileDescriptor } from '../errors.js';
import { decodeText } from '../utils.js';

export default mixin({
  init() {
    const root = {
      cookie: 0n,
      readdir() {
        const offset = Number(this.cookie);
        let dent = null;
        switch (offset) {
          case 0:
          case 1: 
            dent = { name: '.'.repeat(offset + 1), type: 'directory' };
        }
        return dent;
      },
      seek(cookie) { 
        return this.cookie = cookie;
      },
      tell() { 
        return this.cookie;
      },
      valueOf() { 
        return null;
      },
    };
    this.streamMap = new Map([ 
      [ 
        PosixDescriptor.stdout, 
        [ this.createLogWriter('stdout'), PosixDescriptorRight.fd_write, 0 ] 
      ], 
      [ 
        PosixDescriptor.stderr, 
        [ this.createLogWriter('stderr'), PosixDescriptorRight.fd_write, 0 ]
      ], 
      [ 
        PosixDescriptor.root, 
        [ root, PosixDescriptorRight.fd_readdir, 0 ], 
      ] 
    ]);
    this.flushRequestMap = new Map();
    this.nextStreamHandle = PosixDescriptor.min;
  },
  getStream(fd) {
    const entry = this.streamMap.get(fd);
    if (!entry) {
      throw new InvalidFileDescriptor();
    }
    return entry;
  },
  createStreamHandle(stream, rights, flags = 0) {
    const fd = this.nextStreamHandle++;
    this.streamMap.set(fd, [ stream, rights, flags ]);
    stream.onClose = () => this.destroyStreamHandle(fd);
    if (process.env.TARGET === 'node') {
      if (this.streamMap.size === 4) {
        this.setSyscallTrap(true);
      }
    }
    return fd;
  },
  destroyStreamHandle(fd) {
    const entry = this.streamMap.get(fd);
    if (entry) {
      const [ stream ] = entry;
      stream?.destroy?.();
      this.streamMap.delete(fd);
      if (process.env.TARGET === 'node') {
        if (this.streamMap.size === 3) {
          this.setSyscallTrap(false);
        }
      }
    }
  },
  redirectStream(num, arg) {
    const map = this.streamMap;
    const fd = (num === 3) ? PosixDescriptor.root : num;
    const previous = map.get(fd);
    if (arg !== undefined) {
      let stream, rights;
      if (num === 0) {
        stream = this.convertReader(arg);
        rights = PosixDescriptorRight.fd_read;
      } else if (num === 1 || num === 2) {
        stream = this.convertWriter(arg);
        rights = PosixDescriptorRight.fd_write;
      } else if (num === 3) {
        stream = this.convertDirectory(arg);
        rights = PosixDescriptorRight.fd_readdir;
      } else {
        throw new Error(`Expecting 0, 1, 2, or 3, received ${fd}`);
      }
      map.set(fd, [ stream, rights, 0 ]);
    } else {
      map.delete(fd);
    }
    return previous;
  },
  createLogWriter(source) {
    const env = this;
    return {
      pending: [],

      write(chunk) {
          // send text up to the last newline character
          const index = chunk.lastIndexOf(0x0a);
          if (index === -1) {
            this.pending.push(chunk);
          } else {
            const beginning = chunk.subarray(0, index);
            const remaining = chunk.subarray(index + 1);
            this.dispatch([ ...this.pending, beginning ]);
            this.pending.splice(0);
            if (remaining.length > 0) {
              this.pending.push(remaining);
            }
          }
          env.scheduleFlush(this, this.pending.length > 0, 250);
      },
      dispatch(array) {
        const message = decodeText(array);
        env.triggerEvent('log', { source, message });
      },
      flush() {
        if (this.pending.length > 0) {
          this.dispatch(this.pending);
          this.pending.splice(0);
        }
      }
    };
  },
  scheduleFlush(stream, active, delay) {
    const map = this.flushRequestMap;
    const timeout = map.get(stream);
    if (timeout) {
      clearTimeout(timeout);
      map.delete(stream);
    }
    if (active) {
      map.set(stream, setTimeout(() => {
        stream.flush();
        map.delete(stream);
      }, delay));
    }
  },
  flushStreams() {
    if (this.libc) {
      this.flushStdout?.();
    }
    const map = this.flushRequestMap;
    if (map.size > 0) {
      for (const [ stream, timeout ] of map) {
        stream.flush();
        clearTimeout(timeout);
      }
      map.clear();
    }
  },
  ...(process.env.TARGET === 'wasm' ? {
    imports: {
      flushStdout: { argType: '', returnType: '' },
    },
  } : process.env.TARGET === 'node' ? {
    imports: {
      flushStdout: {},
      setRedirectionMask: {},
      setSyscallTrap: {},
    },
    /* c8 ignore next */
  } : undefined),
});
