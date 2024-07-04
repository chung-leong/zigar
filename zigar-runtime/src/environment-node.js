import { Environment, add, getAlignedAddress, isMisaligned } from './environment.js';
import { InvalidDeallocation, ZigError } from './error.js';
import { ALIGN, ATTRIBUTES, FIXED, MEMORY, POINTER_VISITOR } from './symbol.js';

export class NodeEnvironment extends Environment {
  // C code will patch in these functions:
  imports = {
    loadModule: null,
    getBufferAddress: null,
    allocateExternMemory: null,
    freeExternMemory: null,
    obtainExternBuffer: null,
    copyBytes: null,
    findSentinel: null,
    defineStructures: null,
    getFactoryThunk: null,
    runThunk: null,
    runVariadicThunk: null,
    getMemoryOffset: null,
    recreateAddress: null,
  };
  wordSize = [ 'arm64', 'ppc64', 'x64', 's390x' ].includes(process.arch) ? 8 : 4;

  async init() {
    return;
  }

  allocateRelocMemory(len, align) {
    // allocate extra memory for alignment purpose when align is larger than the default
    const extra = (align > this.wordSize * 2 && this.getBufferAddress) ? align : 0;
    const buffer = new ArrayBuffer(len + extra);
    let offset = 0;
    if (extra) {
      const address = this.getBufferAddress(buffer);
      const aligned = getAlignedAddress(address, align);
      offset = aligned - address;
    }
    return this.obtainView(buffer, Number(offset), len);
  }

  allocateHostMemory(len, align) {
    const dv = this.allocateRelocMemory(len, align);
    this.registerMemory(dv);
    return dv;
  }

  freeHostMemory(address, len, align) {
    // no freeing actually occurs--memory will await garbage collection
    const dv = this.unregisterMemory(address);
    if (!dv) {
      throw new InvalidDeallocation(address);
    }
  }

  allocateShadowMemory(len, align) {
    // Node can read into JavaScript memory space so we can keep shadows there
    return this.allocateRelocMemory(len, align);
  }

  freeShadowMemory(dv) {
    // nothing needs to happen
  }

  obtainExternView(address, len) {
    const buffer = this.obtainExternBuffer(address, len);
    buffer[FIXED] = { address, len };
    return this.obtainView(buffer, 0, len);
  }

  getTargetAddress(target, cluster) {
    const dv = target[MEMORY];
    if (cluster) {
      // pointer is pointing to buffer with overlapping views
      if (cluster.misaligned === undefined) {
        const address = this.getBufferAddress(dv.buffer);
        // ensure that all pointers are properly aligned
        for (const target of cluster.targets) {
          const offset = target[MEMORY].byteOffset;
          const align = target.constructor[ALIGN];
          const viewAddress = add(address, offset);
          if (isMisaligned(viewAddress, align)) {
            cluster.misaligned = true;
            break;
          }
        }
        if (cluster.misaligned === undefined)  {
          cluster.misaligned = false;
          cluster.address = address;
        }
      }
      if (!cluster.misaligned) {
        return add(cluster.address, dv.byteOffset);
      }
    } else {
      const align = target.constructor[ALIGN];
      const address = this.getViewAddress(dv);
      if (!isMisaligned(address, align)) {
        this.registerMemory(dv);
        return address;
      }
    }
    // need shadowing
  }

  invokeThunk(thunkId, args) {
    let err;
    // create an object where information concerning pointers can be stored
    this.startContext();
    const attrs = args[ATTRIBUTES];
    if (args[POINTER_VISITOR]) {
      // copy addresses of garbage-collectible objects into memory
      this.updatePointerAddresses(args);
      this.updateShadows();
      err = (attrs)
      ? this.runVariadicThunk(thunkId, args[MEMORY], attrs[MEMORY])
      : this.runThunk(thunkId, args[MEMORY]);
      // create objects that pointers point to
      this.updateShadowTargets();
      this.updatePointerTargets(args);
      this.releaseShadows();
    } else {
      // don't need to do any of that if there're no pointers
      err = (attrs)
      ? this.runVariadicThunk(thunkId, args[MEMORY], attrs[MEMORY])
      : this.runThunk(thunkId, args[MEMORY]);
    }
    // restore the previous context if there's one
    this.endContext();
    if (!this.context) {
      this.flushConsole();
    }
    // errors returned by exported Zig functions are normally written into the
    // argument object and get thrown when we access its retval property (a zig error union)
    // error strings returned by the thunk are due to problems in the thunking process
    // (i.e. bugs in export.zig)
    if (err) {
      throw new ZigError(err);
    }
    return args.retval;
  }
}
