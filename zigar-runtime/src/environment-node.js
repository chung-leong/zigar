import { Environment, add, getAlignedAddress, isInvalidAddress, isMisaligned } from './environment.js';
import { ZigError } from './error.js';
import { ALIGN, MEMORY, POINTER_VISITOR } from './symbol.js';

export class NodeEnvironment extends Environment {
  // C code will patch in these functions:
  imports = {
    loadModule: null,
    extractBufferAddress: null,
    allocateExternMemory: null,
    freeExternMemory: null,
    obtainExternBuffer: null,
    copyBytes: null,
    findSentinel: null,
    defineStructures: null,
    getFactoryThunk: null,
    runThunk: null,
    getMemoryOffset: null,
    recreateAddress: null,
  };
  // use a weak map to store the addresses of shared buffer so that Zig code can free the 
  // underlying memory without causing a crash; basically, we don't want to ask V8 to return
  // the buffer's backing store if there's a chance that the memory is no longer there
  addressMap = new WeakMap();
  /* c8 ignore next */
  defaultAlignment = [ 'arm64', 'ppc64', 'x64', 's390x' ].includes(process.arch) ? 16 : 8;
  nullBuffer = new ArrayBuffer(0);

  allocateRelocMemory(len, align) {
    // allocate extra memory for alignment purpose when align is larger than the default
    const extra = (align > this.defaultAlignment && this.extractBufferAddress) ? align : 0;    
    const buffer = new ArrayBuffer(len + extra);
    let offset = 0;
    if (extra) {
      const address = this.getBufferAddress(buffer);
      const aligned = getAlignedAddress(address, align);
      offset = aligned - address;
    }
    return this.obtainView(buffer, Number(offset), len);
  }

  getBufferAddress(buffer) {
    let address = this.addressMap.get(buffer);
    if (address === undefined) {
      address = this.extractBufferAddress(buffer);
    }
    return address;
  }

  allocateHostMemory(len, align) {
    const dv = this.allocateRelocMemory(len, align);
    this.registerMemory(dv);
    return dv;
  }

  freeHostMemory(address, len, align) {
    // no freeing actually occurs--memory will await garbage collection
    this.unregisterMemory(address);   
  }

  allocateShadowMemory(len, align) {
    // Node can read into JavaScript memory space so we can keep shadows there
    return this.allocateRelocMemory(len, align);
  }

  freeShadowMemory(address, len, align) {
    // nothing needs to happen
  }

  allocateFixedMemory(len, align) {
    const address = this.allocateExternMemory(len, align);
    const dv = this.obtainFixedView(address, len);
    dv[ALIGN] = align;
    return dv;
  }

  freeFixedMemory(address, len, align) {
    if (len === 0) {
      return;
    }
    this.freeExternMemory(address, len, align);
  }

  obtainFixedView(address, len) {
    if (isInvalidAddress(address)) {
      if (!len) {
        // handle zero length slice
        return this.obtainView(this.nullBuffer);
      } else {
        return null;
      }
    } else {
      const buffer = this.obtainExternBuffer(address, len);
      this.addressMap.set(buffer, address);
      return this.obtainView(buffer, 0, len);  
    }
  }

  releaseFixedView(dv) {
    const address = this.addressMap.get(dv.buffer);
    const len = dv.byteLength;
    const align = dv[ALIGN];
    if (address !== undefined && align !== undefined) {
      this.freeFixedMemory(address, len, align);
      this.addressMap.delete(dv.buffer);
    }
  }

  inFixedMemory(object) {
    return this.addressMap.has(object[MEMORY].buffer);
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
      return (cluster.misaligned) ? false : add(cluster.address, dv.byteOffset);
    } else {
      const align = target.constructor[ALIGN];
      const address = this.getViewAddress(dv);
      if (isMisaligned(address, align)) {
        return false;
      }
      this.registerMemory(dv);
      return address;
    }
  }

  invokeThunk(thunkId, args) {
    let err;
    // create an object where information concerning pointers can be stored
    this.startContext();
    if (args[POINTER_VISITOR]) {
      // copy addresses of garbage-collectible objects into memory
      this.updatePointerAddresses(args);
      this.updateShadows();
      err = this.runThunk(thunkId, args[MEMORY]);
      // create objects that pointers point to
      this.updateShadowTargets();
      this.acquirePointerTargets(args);
      this.releaseShadows();
    } else {
      // don't need to do any of that if there're no pointers
      err = this.runThunk(thunkId, args[MEMORY]);
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
