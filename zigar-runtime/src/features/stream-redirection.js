import { PosixDescriptor, PosixDescriptorRight } from '../constants.js';
import { mixin } from '../environment.js';
import { InvalidFileDescriptor, InvalidStream, TooManyFiles, Unsupported } from '../errors.js';
import { decodeText } from '../utils.js';

const stdinRights = [ PosixDescriptorRight.fd_read, 0 ];
const stdoutRights = [ PosixDescriptorRight.fd_write, 0 ];

const defaultDirRights =  PosixDescriptorRight.fd_seek
                        | PosixDescriptorRight.fd_fdstat_set_flags
                        | PosixDescriptorRight.fd_tell
                        | PosixDescriptorRight.path_create_directory
                        | PosixDescriptorRight.path_create_file
                        | PosixDescriptorRight.path_open
                        | PosixDescriptorRight.fd_readdir
                        | PosixDescriptorRight.path_filestat_get
                        | PosixDescriptorRight.path_filestat_set_size
                        | PosixDescriptorRight.path_filestat_set_times
                        | PosixDescriptorRight.fd_filestat_get
                        | PosixDescriptorRight.fd_filestat_set_times
                        | PosixDescriptorRight.path_remove_directory
                        | PosixDescriptorRight.path_unlink_file;
const defaultFileRights = PosixDescriptorRight.fd_datasync
                        | PosixDescriptorRight.fd_read
                        | PosixDescriptorRight.fd_seek
                        | PosixDescriptorRight.fd_sync
                        | PosixDescriptorRight.fd_tell
                        | PosixDescriptorRight.fd_write
                        | PosixDescriptorRight.fd_advise
                        | PosixDescriptorRight.fd_allocate
                        | PosixDescriptorRight.fd_filestat_get
                        | PosixDescriptorRight.fd_filestat_set_times
                        | PosixDescriptorRight.fd_filestat_set_size;

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
      [ PosixDescriptor.root, [ root, this.getDefaultRights('dir'), 0 ] ], 
      [ PosixDescriptor.stdout, [ this.createLogWriter('stdout'), stdoutRights, 0 ] ], 
      [ PosixDescriptor.stderr, [ this.createLogWriter('stderr'), stdoutRights, 0 ] ], 
    ]);
    this.flushRequestMap = new Map();
    this.nextStreamHandle = PosixDescriptor.min;
  },
  getStream(fd) {
    if (process.env.TARGET === 'wasm') {
      if (fd === 3) fd = PosixDescriptor.root;
    }
    const entry = this.streamMap.get(fd);
    if (!entry) {
      if (2 < fd && fd < PosixDescriptor.min) {
        throw new Unsupported();
      }
      throw new InvalidFileDescriptor();
    }
    return entry;
  },  
  createStreamHandle(stream, rights, flags = 0) {
    if (!this.ioRedirection) {
      throw new Unsupported();
    }
    let fd = this.nextStreamHandle++;
    if (fd > PosixDescriptor.max) {
      // look for free slot
      fd = PosixDescriptor.min;
      while (this.streamMap.get(fd)) {      
        fd++;
        if (fd > PosixDescriptor.max) {
          throw new TooManyFiles();
        }
      }
      this.nextStreamHandle = fd + 1;
    }
    this.streamMap.set(fd, [ stream, rights, flags ]);
    stream.onClose = () => this.destroyStreamHandle(fd);
    if (process.env.TARGET === 'node') {
      if (process.platform === 'linux' && this.streamMap.size === 4) {
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
        if (process.platform === 'linux' && this.streamMap.size === 3) {
          this.setSyscallTrap(false);
        }
      }
    }
  },
  redirectStream(name, arg) {
    const map = this.streamMap;
    const fd = PosixDescriptor[name];
    const previous = map.get(fd);
    if (arg !== undefined) {
      let stream, rights;
      if (fd === PosixDescriptor.stdin) {
        stream = this.convertReader(arg);
        rights = stdinRights;
      } else if (fd === PosixDescriptor.stdout || fd === PosixDescriptor.stderr) {
        stream = this.convertWriter(arg);
        rights = stdoutRights;
      } else if (fd === PosixDescriptor.root) {
        stream = this.convertDirectory(arg);
        rights = this.getDefaultRights('dir');
      } else {
        throw new Error(`Expecting 'stdin', 'stdout', 'stderr', or 'root', received ${name}`);
      }
      if (!stream) {
        throw new InvalidStream(rights[0], arg);
      }
      map.set(fd, [ stream, rights, 0 ]);
    } else {
      map.delete(fd);
    }
    return previous?.[0];
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
        if (env.triggerEvent('log', { source, message }) == undefined) {
          console.log(message);
        }
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
    const map = this.flushRequestMap;
    if (map.size > 0) {
      for (const [ stream, timeout ] of map) {
        stream.flush();
        clearTimeout(timeout);
      }
      map.clear();
    }
  },
  getDefaultRights(type) {
    if (type === 'dir') {
      return [ defaultDirRights, defaultDirRights | defaultFileRights ];
    } else {
      return [ defaultFileRights, 0 ];
    }
  },
  ...(process.env.TARGET === 'node' ? {
    imports: {
      setRedirectionMask: {},
      setSyscallTrap: {},
    },
    /* c8 ignore next */
  } : undefined),
});

