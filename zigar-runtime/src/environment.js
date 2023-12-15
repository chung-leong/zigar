import { defineProperties, getStructureFactory, getStructureName } from './structure.js';
import { decodeText } from './text.js';
import { initializeErrorSets } from './error-set.js';
import { throwAlignmentConflict, throwNullPointer, throwZigError } from './error.js';
import { getCopyFunction, getMemoryCopier, restoreMemory } from './memory.js';
import { addStaticMembers } from './static.js';
import { addMethods } from './method.js';
import { addSpecialAccessors } from './special.js';
import { ADDRESS_GETTER, ADDRESS_SETTER, ALIGN, ENVIRONMENT, LENGTH_GETTER, LENGTH_SETTER, MEMORY,
  MEMORY_COPIER, POINTER_SELF, POINTER_VISITOR, SENTINEL, SHADOW_ATTRIBUTES, SIZE, SLOTS
} from './symbol.js';

const defAlign = 16;

export class Environment {
  context;
  contextStack = [];
  consolePending = [];
  consoleTimeout = 0;
  emptyView = new DataView(new ArrayBuffer(0));
  initPromise;
  abandoned = false;
  released = false;
  littleEndian = true;
  runtimeSafety = true;
  /* COMPTIME-ONLY */
  slots = {};
  structures = [];
  /* COMPTIME-ONLY-END */
  /* RUNTIME-ONLY */
  variables = [];
  /* RUNTIME-ONLY-END */
  imports;

  /*
  Functions to be defined in subclass:

  getBufferAddress(buffer: ArrayBuffer): bigint|number {
    // return a buffer's address
  }
  allocateRelocatableMemory(len: number, align: number): DataView {
    // allocate memory and remember its address
  }
  allocateShadowMemory(len: number, align: number): DataView {
    // allocate memory for shadowing objects
  }
  freeRelocatableMemory(address: bigint|number, len: number, align: number): void {
    // free previously allocated memory
  }
  freeShadowMemory(address: bigint|number, len: number, align: number): void {
    // free memory allocated for shadow
  }
  allocateFixedMemory(len: number, align: number): DataView {
    // allocate fixed memory and keep a reference to it
  }
  freeFixedMemory(address: bigint|number, len: number, align: number): void {
    // free previously allocated fixed memory return the reference
  }
  obtainFixedView(address: bigint|number, len: number): DataView {
    // obtain a data view of memory at given address
  }
  inFixedMemory(object: object): boolean {
    // return true/false depending on whether object is in fixed memory
  }
  copyBytes(dst: DataView, address: bigint|number, len: number): void {
    // copy memory at given address into destination view
  }
  findSentinel(address: bigint|number, bytes: DataView): number {
    // return offset where sentinel value is found
  }
  getMemoryOffset(address: bigint|number) number {
    // return offset of address relative to start of module memory
  }
  recreateAddress(reloc: number) number {
    // recreate address of memory belonging to module
  }

  getTargetAddress(target: object, cluster: object|undefined) {
    // return the address of target's buffer if correctly aligned
  }
  */

  startContext() {
    if (this.context) {
      this.contextStack.push(this.context);
    }
    this.context = new CallContext();
  }

  endContext() {
    this.context = this.contextStack.pop();
  }

  createBuffer(len, align, fixed = false) {
    if (fixed) {
      return this.createFixedBuffer(len);
    } else {
      return this.createRelocatableBuffer(len, align);
    }
  }

  createRelocatableBuffer(len) {
    const buffer = new ArrayBuffer(len);
    return new DataView(buffer);
  }

  registerMemory(dv, targetDV = null) {
    const { memoryList } = this.context;
    const address = this.getViewAddress(dv);
    const index = findMemoryIndex(memoryList, address);
    memoryList.splice(index, 0, { address, dv, len: dv.byteLength, targetDV });
    return address;
  }

  unregisterMemory(address) {
    const { memoryList } = this.context;
    const index = findMemoryIndex(memoryList, address);
    const prev = memoryList[index - 1];
    if (prev?.address === address) {
      memoryList.splice(index - 1, 1);
    }
  }

  findMemory(address, len) {
    // check for null address (=== can't be used since address can be both number and bigint)
    if (!address) {
      return this.emptyView;
    }
    if (this.context) {
      const { memoryList, shadowMap } = this.context;
      const index = findMemoryIndex(memoryList, address);
      const prev = memoryList[index - 1];
      if (prev?.address === address && prev.len === len) {
        return prev.targetDV ?? prev.dv;
      } else if (prev?.address <= address && address < add(prev.address, prev.len)) {
        const offset = Number(address - prev.address) + prev.dv.byteOffset;
        if (prev.targetDV) {
          return new DataView(prev.targetDV.buffer, prev.targetDV.byteOffset + offset, len);
        } else {
          return new DataView(prev.dv.buffer, prev.dv.byteOffset + offset, len);
        }
      }
    }
    // not found in any of the buffers we've seen--assume it's fixed memory
    return this.obtainFixedView(address, len);
  }

  getViewAddress(dv) {
    const address = this.getBufferAddress(dv.buffer);
    return add(address, dv.byteOffset);
  }

  createView(address, len, copy) {
    if (copy) {
      const dv = this.createRelocatableBuffer(len);
      this.copyBytes(dv, address, len);
      return dv;
    } else {
      return this.obtainFixedView(address, len);
    }
  }

  createObject(structure, arg) {
    const { constructor } = structure;
    return new constructor(arg);
  }

  castView(structure, dv) {
    const { constructor, hasPointer } = structure;
    const object = constructor.call(ENVIRONMENT, dv);
    if (hasPointer) {
      // acquire targets of pointers
      this.acquirePointerTargets(object);
    }
    return object;
  }

  /* COMPTIME-ONLY */
  readSlot(target, slot) {
    const slots = target ? target[SLOTS] : this.slots;
    return slots?.[slot];
  }

  writeSlot(target, slot, value) {
    const slots = target ? target[SLOTS] : this.slots;
    if (slots) {
      slots[slot] = value;
    }
  }

  createTemplate(dv) {
    return {
      [MEMORY]: dv,
      [SLOTS]: {}
    };
  }

  beginStructure(def) {
    const {
      type,
      name,
      length,
      byteSize,
      align,
      isConst,
      hasPointer,
    } = def;
    return {
      constructor: null,
      typedArray: null,
      type,
      name,
      length,
      byteSize,
      align,
      isConst,
      hasPointer,
      instance: {
        members: [],
        methods: [],
        template: null,
      },
      static: {
        members: [],
        methods: [],
        template: null,
      },
    };
  }

  attachMember(s, member, isStatic = false) {
    const target = (isStatic) ? s.static : s.instance;
    target.members.push(member);
  }

  attachMethod(s, method, isStaticOnly = false) {
    s.static.methods.push(method);
    if (!isStaticOnly) {
      s.instance.methods.push(method);
    }
  }

  attachTemplate(s, template, isStatic = false) {
    const target = (isStatic) ? s.static : s.instance;
    target.template = template;
  }

  endStructure(s) {
    this.structures.push(s);
    this.acquireDefaultPointers(s);
  }

  acquireStructures(options) {
    const {
      omitFunctions = false,
    } = options;
    if (omitFunctions) {
      this.attachMethod = () => {};
    }
    initializeErrorSets();
    const result = this.defineStructures();
    if (typeof(result) === 'string') {
      throwZigError(result);
    }
  }

  getRootModule() {
    const root = this.structures[this.structures.length - 1];
    return root.constructor;
  }

  exportStructures() {
    this.prepareObjectsForExport();
    return this.structures;
  }

  prepareObjectsForExport() {
    const list = [];
    const find = (object) => {
      if (!object) {
        return;
      }
      if (object[MEMORY]) {
        let dv = object[MEMORY];
        if (this.inFixedMemory(object)) {
          // replace fixed memory
          const address = this.getViewAddress(dv);
          const offset = this.getMemoryOffset(address);
          const len = dv.byteLength;
          const relocDV = this.createView(address, len, true);
          relocDV.reloc = offset;
          dv = relocDV;
          list.push({ offset, len, owner: object, replaced: false });
        }
        // use regular property since symbols are private to module
        object.memory = dv;
      }
      if (object[SLOTS]) {
        const slots = object[SLOTS];
        for (const child of Object.values(object[SLOTS])) {
          find(child);
        }
        object.slots = slots;
      }
    };
    for (const structure of this.structures) {
      find(structure.instance.template);
      find(structure.static.template);
    }
    // larger memory blocks come first
    list.sort((a, b) => b.len - a.len);
    for (const a of list) {
      for (const b of list) {
        if (a !== b && !a.replaced) {
          if (a.offset <= b.offset && b.offset + b.len <= a.offset + a.len) {
            // B is inside A--replace it with a view of A's buffer
            const dv = a.owner.memory;
            const pos = b.offset - a.offset + dv.byteOffset;
            const newDV = new DataView(dv.buffer, pos, b.len);
            newDV.reloc = b.offset;
            b.owner.memory = newDV;
            b.replaced = true;
          }
        }
      }
    }
  }
  /* COMPTIME-ONLY-END */

  finalizeShape(s) {
    const f = getStructureFactory(s.type);
    const constructor = f(s, this);
    if (typeof(constructor) === 'function') {
      defineProperties(constructor, {
        name: { value: getStructureName(s), writable: false }
      });
      if (!constructor.prototype.hasOwnProperty(Symbol.toStringTag)) {
        defineProperties(constructor.prototype, {
          [Symbol.toStringTag]: { value: s.name, configurable: true, writable: false }
        });
      }
    }
  }

  finalizeStructure(s) {
    addStaticMembers(s, this);
    addMethods(s, this);
    addSpecialAccessors(s, this);
  }

  createCaller(method, useThis) {
    let { name,  argStruct, thunkId } = method;
    const { constructor } = argStruct;
    const self = this;
    let f;
    if (useThis) {
      f = function(...args) {
        return self.invokeThunk(thunkId, new constructor([ this, ...args ]));
      }
    } else {
      f = function(...args) {
        return self.invokeThunk(thunkId, new constructor(args));
      }
    }
    Object.defineProperty(f, 'name', { value: name });
    return f;
  }

  /* RUNTIME-ONLY */
  recreateStructures(structures) {
    const createTemplate = (placeholder) => {
      const template = {};
      if (placeholder.memory) {
        const { array, offset, length } = placeholder.memory;
        template[MEMORY] = new DataView(array.buffer, offset, length);
      }
      if (placeholder.slots) {
        template[SLOTS] = insertObjects({}, placeholder.slots);
      }
      return template;
    };
    const insertObjects = (dest, placeholders) => {
      for (const [ slot, placeholder ] of Object.entries(placeholders)) {
        dest[slot] = placeholder ? createObject(placeholder) : null;
      }
      return dest;
    };
    const recreateScope = (scope) => {
      if (scope.template) {
        scope.template = createTemplate(scope.template);
      }
    };
    const createObject = (placeholder) => {
      if (placeholder.memory) {
        const { array, offset, length } = placeholder.memory;
        const dv = new DataView(array.buffer, offset, length);
        const { constructor } = placeholder.structure;
        const object = constructor.call(ENVIRONMENT, dv);
        if (placeholder.slots) {
          insertObjects(object[SLOTS], placeholder.slots);
        }
        if (placeholder.hasOwnProperty('reloc')) {
          // need to replace dataview with one pointing to fixed memory later,
          // when the VM is up and running
          this.variables.push({ reloc: placeholder.reloc, object });
        }
        return object;  
      } else {
        return placeholder.structure;
      }
    };
    initializeErrorSets();
    for (const structure of structures) {
      // first create the actual template using the provided placeholder
      recreateScope(structure.instance);
      // finalize the shape before we recreate the static template as 
      // the template can have objects of this structure 
      this.finalizeShape(structure);
      recreateScope(structure.static);
      // add static members, methods, etc.
      this.finalizeStructure(structure);
    }
  }

  linkVariables(writeBack) {
    for (const { object, reloc } of this.variables) {
      this.linkObject(object, reloc, writeBack);
    }
  }

  linkObject(object, reloc, writeBack) {
    if (this.inFixedMemory(object)) {
      return;
    }
    const dv = object[MEMORY];
    if (dv.byteLength !== 0) {
      const address = this.recreateAddress(reloc);
      const fixedDV = this.obtainFixedView(address, dv.byteLength);
      if (writeBack) {
        const dest = Object.create(object.constructor.prototype);
        dest[MEMORY] = fixedDV;
        dest[MEMORY_COPIER](object);
      }
      object[MEMORY] = fixedDV;
    }
  }

  unlinkVariables() {
    for (const { object } of this.variables) {
      this.unlinkObject(object);
    }
  }

  unlinkObject(object) {
    if (!this.inFixedMemory(object)) {
      return;
    }
    const dv = object[MEMORY];
    const relocDV = this.createRelocatableBuffer(dv.byteLength);
    const dest = Object.create(object.constructor.prototype);
    dest[MEMORY] = relocDV;
    dest[MEMORY_COPIER](object);
    object[MEMORY] = relocDV;
  }

  releaseFunctions() {
    const throwError = function() {
      throw new Error(`Module was abandoned`);
    };
    for (const name of Object.keys(this.imports)) {
      if (this[name]) {
        this[name] = throwError;
      }
    }
  }

  getControlObject() {
    return {
      init: () => this.initPromise ?? Promise.resolve(),
      abandon: () => this.abandon(),
      released: () => this.released,
    }
  }

  abandon() {
    if (!this.abandoned) {
      this.releaseFunctions();
      this.unlinkVariables();
      this.abandoned = true;
    }
  }

  writeToConsole(dv) {
    try {
      // make copy of array, in case incoming buffer is pointing to stack memory
      const array = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength).slice();
      // send text up to the last newline character
      const index = array.lastIndexOf(0x0a);
      if (index === -1) {
        this.consolePending.push(array);
      } else {
        const beginning = array.subarray(0, index);
        const remaining = array.subarray(index + 1);
        const list = [ ...this.consolePending, beginning ];
        console.log(decodeText(list));
        this.consolePending = (remaining.length > 0) ? [ remaining ] : [];
      }
      clearTimeout(this.consoleTimeout);
      if (this.consolePending.length > 0) {
        this.consoleTimeout = setTimeout(() => {
          console.log(decodeText(this.consolePending));
          this.consolePending = [];
        }, 250);
      }
      /* c8 ignore next 3 */
    } catch (err) {
      console.error(err);
    }
  }

  flushConsole() {
    if (this.consolePending.length > 0) {
      console.log(decodeText(this.consolePending));
      this.consolePending = [];
      clearTimeout(this.consoleTimeout);
    }
  }

  updatePointerAddresses(args) {
    // first, collect all the pointers
    const pointerMap = new Map();
    const bufferMap = new Map();
    const potentialClusters = [];
    const env = this;
    const callback = function({ isActive }) {
      if (!isActive(this)) {
        return;
      }
      // bypass proxy
      const pointer = this[POINTER_SELF];
      if (pointerMap.get(pointer)) {
        return;
      }
      const target = pointer[SLOTS][0];
      if (target) {
        pointerMap.set(pointer, target);
        if (!env.inFixedMemory(target)) {
          // see if the buffer is shared with other objects
          const dv = target[MEMORY];
          const other = bufferMap.get(dv.buffer);
          if (other) {
            const array = Array.isArray(other) ? other : [ other ];
            const index = findSortedIndex(array, dv.byteOffset, t => t[MEMORY].byteOffset);
            array.splice(index, 0, target);
            if (!Array.isArray(other)) {
              bufferMap.set(dv.buffer, array);
              potentialClusters.push(array);
            }
          } else {
            bufferMap.set(dv.buffer, target);
          }
          // scan pointers in target
          target[POINTER_VISITOR]?.(callback);
        }
      }
    };
    args[POINTER_VISITOR](callback);
    // find targets that overlap each other
    const clusters = this.findTargetClusters(potentialClusters);
    const clusterMap = new Map();
    for (const cluster of clusters) {
      for (const target of cluster.targets) {
        clusterMap.set(target, cluster);
      }
    }
    // process the pointers
    for (const [ pointer, target ] of pointerMap) {
      const cluster = clusterMap.get(target);
      let address = this.getTargetAddress(target, cluster);
      if (address === false) {
        // need to shadow the object
        address = this.getShadowAddress(target, cluster);
      }
      // update the pointer
      pointer[ADDRESS_SETTER](address);
      pointer[LENGTH_SETTER]?.(target.length);
    }
  }

  findTargetClusters(potentialClusters) {
    const clusters = [];
    for (const targets of potentialClusters) {
      let prevTarget = null, prevStart = 0, prevEnd = 0;
      let currentCluster = null;
      for (const target of targets) {
        const dv = target[MEMORY];
        const { byteOffset: start, byteLength } = dv;
        const end = start + byteLength;
        let forward = true;
        if (prevTarget) {
          if (prevEnd > start) {
            // the previous target overlaps this one
            if (!currentCluster) {
              currentCluster = {
                targets: [ prevTarget ],
                start: prevStart,
                end: prevEnd,
                address: undefined,
                misaligned: undefined,
              };
              clusters.push(currentCluster);
            }
            currentCluster.targets.push(target);
            if (end > prevEnd) {
              // set cluster end offset to include this one
              currentCluster.end = end;
            } else {
              // the previous target contains this one
              forward = false;
            }
          } else {
            currentCluster = null;
          }
        }
        if (forward) {
          prevTarget = target;
          prevStart = start;
          prevEnd = end;
        }
      }
    }
    return clusters;
  }

  getShadowAddress(target, cluster) {
    if (cluster) {
      const dv = target[MEMORY];
      if (cluster.address === undefined) {
        const shadow = this.createClusterShadow(cluster);
        cluster.address = this.getViewAddress(shadow[MEMORY]);
      }
      return add(cluster.address, dv.byteOffset);
    } else {
      const shadow = this.createShadow(target);
      return this.getViewAddress(shadow[MEMORY]);
    }
  }

  createShadow(object) {
    const dv = object[MEMORY]
    const align = object.constructor[ALIGN];
    const shadow = Object.create(object.constructor.prototype);
    const shadowDV = shadow[MEMORY] = this.allocateShadowMemory(dv.byteLength, align);
    shadow[SHADOW_ATTRIBUTES] = {
      address: this.getViewAddress(shadowDV),
      len: shadowDV.byteLength,
      align: align,
    };
    return this.addShadow(shadow, object);
  }

  createClusterShadow(cluster) {
    const { start, end, targets } = cluster;
    // look for largest align
    let maxAlign = 0, maxAlignOffset;
    for (const target of targets) {
      const offset = target[MEMORY].byteOffset;
      const align = target.constructor[ALIGN];
      if (align > maxAlign) {
        maxAlign = align;
        maxAlignOffset = offset;
      }
    }
    // ensure the shadow buffer is large enough to accommodate necessary adjustments
    const len = end - start;
    const unalignedShadowDV = this.allocateShadowMemory(len + maxAlign, 1);
    const unalignedAddress = this.getViewAddress(unalignedShadowDV);
    const maxAlignAddress = getAlignedAddress(add(unalignedAddress, maxAlignOffset), maxAlign);
    const shadowAddress = subtract(maxAlignAddress, maxAlignOffset);
    const shadowOffset = unalignedShadowDV.byteOffset + Number(shadowAddress - unalignedAddress);
    const shadowDV = new DataView(unalignedShadowDV.buffer, shadowOffset, len);
    // make sure that other pointers are correctly aligned also
    for (const target of targets) {
      const offset = target[MEMORY].byteOffset;
      if (offset !== maxAlignOffset) {
        const align = target.constructor[ALIGN];
        if (isMisaligned(add(shadowAddress, offset), align)) {
          throwAlignmentConflict(align, maxAlign);
        }
      }
    }
    // placeholder object type
    const prototype = {
      [MEMORY_COPIER]: getMemoryCopier(len)
    };
    const source = Object.create(prototype);
    const shadow = Object.create(prototype);
    source[MEMORY] = new DataView(targets[0][MEMORY].buffer, Number(start), len);
    shadow[MEMORY] = shadowDV;
    shadow[SHADOW_ATTRIBUTES] = {
      address: unalignedAddress,
      len: unalignedShadowDV.byteLength,
      align: 1,
    };
    return this.addShadow(shadow, source);
  }

  addShadow(shadow, object) {
    let { shadowMap } = this.context;
    if (!shadowMap) {
      shadowMap = this.context.shadowMap = new Map();
    }
    shadowMap.set(shadow, object);
    this.registerMemory(shadow[MEMORY], object[MEMORY]);
    return shadow;
  }

  removeShadow(dv) {
    const { shadowMap } = this.context;
    if (shadowMap) {
      for (const [ shadow ] of shadowMap) {
        if (shadow[MEMORY] === dv) {
          shadowMap.delete(shadow);
          break;
        }
      }
    }
  }

  updateShadows() {
    const { shadowMap } = this.context;
    if (!shadowMap) {
      return;
    }
    for (const [ shadow, object ] of shadowMap) {
      shadow[MEMORY_COPIER](object);
    }
  }

  updateShadowTargets() {
    const { shadowMap } = this.context;
    if (!shadowMap) {
      return;
    }
    for (const [ shadow, object ] of shadowMap) {
      object[MEMORY_COPIER](shadow);
    }
  }

  releaseShadows() {
    const { shadowMap } = this.context;
    if (!shadowMap) {
      return;
    }
    for (const [ shadow ] of shadowMap) {
      const { address, len, align } = shadow[SHADOW_ATTRIBUTES];
      this.freeShadowMemory(address, len, align);
    }
  }
  /* RUNTIME-ONLY-END */

  acquirePointerTargets(args) {
    const env = this;
    const pointerMap = new Map();
    const callback = function({ isActive, isMutable }) {
      const pointer = this[POINTER_SELF];
      if (isActive(this) === false) {
        pointer[SLOTS][0] = null;
        return;
      }
      if (pointerMap.get(pointer)) {
        return;
      }
      const Target = pointer.constructor.child;
      let target = this[SLOTS][0];
      if (!target || isMutable(this)) {
        // obtain address (and possibly length) from memory
        const address = pointer[ADDRESS_GETTER]();
        let len = pointer[LENGTH_GETTER]?.();
        if (len === undefined) {
          const sentinel = Target[SENTINEL];
          if (sentinel) {
            if (address === 0) {
              throwNullPointer(address, sentinel);
            }
            len = env.findSentinel(address, sentinel.bytes) + 1;
          } else {
            len = 1;
          }
        }
        // get view of memory that pointer points to
        const byteLength = len * Target[SIZE];
        const dv = env.findMemory(address, byteLength);
        if (dv !== env.emptyView || byteLength == 0) {
          // create the target
          target = this[SLOTS][0] = Target.call(this, dv);
        }
      }
      if (target?.[POINTER_VISITOR]) {
        // acquire objects pointed to by pointers in target
        const isMutable = (pointer.constructor.const) ? () => false : () => true;
        target[POINTER_VISITOR](callback, { vivificate: true, isMutable });
      }
    }
    args[POINTER_VISITOR](callback, { vivificate: true });
  }

  /* COMPTIME-ONLY */
  acquireDefaultPointers(s) {
    const { constructor, hasPointer, instance: { template } } = s;
    if (hasPointer && template && template[MEMORY]) {
      // create a placeholder for retrieving default pointers
      const placeholder = Object.create(constructor.prototype);
      placeholder[MEMORY] = template[MEMORY];
      placeholder[SLOTS] = template[SLOTS];
      this.acquirePointerTargets(placeholder);
    }
  }
  /* COMPTIME-ONLY-END */
}

/* NODE-ONLY */
export class NodeEnvironment extends Environment {
  // C code will patch in these functions:
  imports = {
    extractBufferAddress: null,
    allocateExternalMemory: null,
    freeExternalMemory: null,
    obtainExternalBuffer: null,
    copyBytes: null,
    findSentinel: null,
    getMemoryOffset: null,
    recreateAddress: null,
  };
  // use a weak map to store the addresses of shared buffer, so that we can
  // Zig code can free the underlying memory without leading to a crash
  // basically, we don't want to ask V8 to return the buffer's backing store
  // if there's a chance that the memory is no longer there
  addressMap = new WeakMap();

  getBufferAddress(buffer) {
    let address = this.addressMap.get(buffer);
    if (address === undefined) {
      address = this.extractBufferAddress(buffer);
    }
    return address;
  }

  allocateRelocatableMemory(len, align) {
    const dv = this.createAlignedBuffer(len, align);
    this.registerMemory(dv);
    return dv;
  }

  freeRelocatableMemory(address, len, align) {
    this.unregisterMemory(address);
  }

  allocateShadowMemory(len, align) {
    return this.createAlignedBuffer(len, align);
  }

  freeShadowMemory(address, len, align) {
    // nothing needs to happen
  }

  allocateFixedMemory(len, align) {
    const buffer = this.allocateExternalMemory(len, align);
    const address = this.extractBufferAddress(buffer);
    this.addressMap.set(buffer, address);
    return new DataView(buffer);
  }

  freeFixedMemory(address, len, align) {
    this.freeExternalMemory(address, len, align);
  }

  obtainFixedView(address, len) {
    if (len === 0) {
      return this.emptyView;
    }
    const buffer = this.obtainExternalBuffer(address, len);
    this.addressMap.set(buffer, address);
    return new DataView(buffer);
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
      return (cluster.misaligned) ? false : cluster.address + dv.byteOffset;
    } else {
      const align = target.constructor[ALIGN];
      const address = this.getViewAddress(dv);
      if (isMisaligned(address, align)) {
        return false;
      }
      this.registerMemory(dv);
      return  address;
    }
  }

  createAlignedBuffer(len, align) {
    // allocate extra memory for alignment purpose when align is larger than the default
    const extra = (align > 16) ? align : 0;
    const buffer = new ArrayBuffer(len + extra);
    let offset = 0;
    if (extra) {
      const address = this.getBufferAddress(buffer);
      const aligned = getAlignedAddress(address, align);
      offset = aligned - address;
    }
    return new DataView(buffer, Number(offset), len);
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
      console.log({ err });
      throwZigError(err);
    }
    return args.retval;
  }
}
/* NODE-ONLY-END */

/* WASM-ONLY */
export class WebAssemblyEnvironment extends Environment {
  imports = {
    defineStructures: { argType: '', returnType: 'v' },
    allocateFixedMemory: { argType: 'ii', returnType: 'v' },
    freeFixedMemory: { argType: 'iii' },
    allocateShadowMemory: { argType: 'cii', returnType: 'v' },
    freeShadowMemory: { argType: 'ciii' },
    runThunk: { argType: 'iv', returnType: 'v' },
    isRuntimeSafetyActive: { argType: '', returnType: 'b' },
  };
  exports = {
    allocateRelocatableMemory: { argType: 'ii', returnType: 'v' },
    freeRelocatableMemory: { argType: 'iii' },
    createString: { argType: 'ii', returnType: 'v' },
    createObject: { argType: 'vv', returnType: 's' },
    createView: { argType: 'iib', returnType: 'v' },
    castView: { argType: 'vv', returnType: 'v' },
    readSlot: { argType: 'vi', returnType: 'v' },
    writeSlot: { argType: 'viv' },
    getViewAddress: { argType: 'v', returnType: 'i' },
    beginDefinition: { returnType: 'v' },
    insertInteger: { argType: 'vsi', alias: 'insertProperty' },
    insertBoolean: { argType: 'vsb', alias: 'insertProperty' },
    insertString: { argType: 'vss', alias: 'insertProperty' },
    insertObject: { argType: 'vsv', alias: 'insertProperty' },
    beginStructure: { argType: 'v', returnType: 'v' },
    attachMember: { argType: 'vvb' },
    attachMethod: { argType: 'vvb' },
    createTemplate: { argType: 'v', returnType: 'v' },
    attachTemplate: { argType: 'vvb' },
    finalizeShape: { argType: 'v' },
    endStructure: { argType: 'v' },
    writeToConsole: { argType: 'v' },
    startCall: { argType: 'iv', returnType: 'i' },
    endCall: { argType: 'iv', returnType: 'i' },
  };
  nextValueIndex = 1;
  valueTable = { 0: null };
  valueIndices = new Map;
  memory = null;
  // WASM is always little endian
  littleEndian = true;

  constructor() {
    super();
  }

  allocateRelocatableMemory(len, align) {
    // allocate memory in both JS and WASM space
    const constructor = { [ALIGN]: align };
    const copier = getMemoryCopier(len);
    const dv = this.createBuffer(len);
    const shadowDV = this.allocateShadowMemory(len, align);
    // create a shadow for the relocatable memory
    const object = { constructor, [MEMORY]: dv, [MEMORY_COPIER]: copier };
    const shadow = { constructor, [MEMORY]: shadowDV, [MEMORY_COPIER]: copier };
    shadow[SHADOW_ATTRIBUTES] = { address: this.getViewAddress(shadowDV), len, align };
    this.addShadow(shadow, object);
    return shadowDV;
  }

  freeRelocatableMemory(address, len, align) {
    const dv = this.findMemory(address, len);
    this.removeShadow(dv);
    this.unregisterMemory(address);
    this.freeShadowMemory(address, len, align);
  }

  getBufferAddress(buffer) {
    /* DEV-TEST */
    if (buffer !== this.memory.buffer) {
      throw new Error('Cannot obtain address of relocatable buffer');
    }
    /* DEV-TEST-END */
    return 0;
  }

  obtainFixedView(address, len) {
    if (len === 0) {
      return this.emptyView;
    }
    const { memory } = this;
    const dv = new DataView(memory.buffer, address, len);
    dv[MEMORY] = { memory, address, len };
    return dv;
  }

  inFixedMemory(object) {
    // reconnect any detached buffer before checking
    restoreMemory.call(object);
    return object[MEMORY].buffer === this.memory.buffer;
  }

  copyBytes(dst, address, len) {
    const { memory } = this;
    const src = new DataView(memory.buffer, address, len);
    const copy = getCopyFunction(len);
    copy(dst, src);
  }

  findSentinel(address, bytes) {
    const { memory } = this;
    const len = bytes.byteLength;
    const end = memory.buffer.byteLength - len + 1;
    for (let i = address; i < end; i += len) {
      const dv = new DataView(memory.buffer, i, len);
      let match = true;
      for (let j = 0; j < len; j++) {
        const a = dv.getUint8(j);
        const b = bytes.getUint8(j);
        if (a !== b) {
          match = false;
          break;
        }
      }
      if (match) {
        return (i - address) / len;
      }
    }
  }

  createString(address, len) {
    const { buffer } = this.memory;
    const ta = new Uint8Array(buffer, address, len);
    return decodeText(ta);
  }

  getTargetAddress(target, cluster) {
    if (this.inFixedMemory(target)) {
      return this.getViewAddress(target[MEMORY]);
    }
    if (target[MEMORY].byteLength === 0) {
      // it's a null pointer/empty slice
      return 0;
    }
    // relocatable buffers always need shadowing
    return false;
  }

  clearExchangeTable() {
    if (this.nextValueIndex !== 1) {
      this.nextValueIndex = 1;
      this.valueTable = { 0: null };
      this.valueIndices = new Map();
    }
  }

  getObjectIndex(object) {
    if (object) {
      let index = this.valueIndices.get(object);
      if (index === undefined) {
        index = this.nextValueIndex++;
        this.valueIndices.set(object, index);
        this.valueTable[index] = object;
      }
      return index;
    } else {
      return 0;
    }
  }

  fromWebAssembly(type, arg) {
    switch (type) {
      case 'v':
      case 's': return this.valueTable[arg];
      case 'i': return arg;
      case 'b': return !!arg;
    }
  }

  toWebAssembly(type, arg) {
    switch (type) {
      case 'v':
      case 's': return this.getObjectIndex(arg);
      case 'i': return arg;
      case 'b': return arg ? 1 : 0;
    }
  }

  exportFunction(fn, argType = '', returnType = '') {
    if (!fn) {
      return () => {};
    }
    return (...args) => {
      args = args.map((arg, i) => this.fromWebAssembly(argType.charAt(i), arg));
      const retval = fn.apply(this, args);
      return this.toWebAssembly(returnType, retval);
    };
  }

  importFunction(fn, argType = '', returnType = '') {
    let needCallContext = false;
    if (argType.startsWith('c')) {
      needCallContext = true;
      argType = argType.slice(1);
    }
    return (...args) => {
      args = args.map((arg, i) => this.toWebAssembly(argType.charAt(i), arg));
      if (needCallContext) {
        args = [ this.context.call, ...args ];
      }
      const retval = fn.apply(this, args);
      return this.fromWebAssembly(returnType, retval);
    };
  }

  exportFunctions() {
    const imports = {};
    for (const [ name, { argType, returnType, alias } ] of Object.entries(this.exports)) {
      const fn = this[alias ?? name];
      imports[`_${name}`] = this.exportFunction(fn, argType, returnType);
    }
    return imports;
  }

  importFunctions(exports) {
    for (const [ name, fn ] of Object.entries(exports)) {
      const info = this.imports[name];
      if (info) {
        const { argType, returnType } = info;
        this[name] = this.importFunction(fn, argType, returnType);
      }
    }
  }

  async instantiateWebAssembly(source) {
    const env = this.exportFunctions();
    if (source[Symbol.toStringTag] === 'Response') {
      return WebAssembly.instantiateStreaming(source, { env });
    } else {
      const buffer = await source;
      return WebAssembly.instantiate(buffer, { env });
    }
  }

  async loadModule(source) {
    return this.initPromise = (async () => {
      const { instance } = await this.instantiateWebAssembly(source);
      this.memory = instance.exports.memory;
      this.importFunctions(instance.exports);
      this.trackInstance(instance);
      this.runtimeSafety = this.isRuntimeSafetyActive();
    })();
  }

  trackInstance(instance) {
    // use WeakRef to detect whether web-assembly instance has been gc'ed
    const ref = new WeakRef(instance);
    Object.defineProperty(this, 'released', { get: () => !ref.deref(), enumerable: true });
  }

  linkVariables(writeBack) {
    // linkage occurs when WASM compilation is complete and functions have been imported
    this.initPromise = this.initPromise.then(() => super.linkVariables(writeBack));
  }

  startCall(call, args) {
    this.startContext();
    // call context, used by allocateShadowMemory and freeShadowMemory
    this.context.call = call;
    if (args) {
      if (args[POINTER_VISITOR]) {
        this.updatePointerAddresses(args);
      }
      // return address of shadow for argumnet struct
      const address = this.getShadowAddress(args);
      this.updateShadows();
      return address;
    }
    // can't be 0 since that sets off Zig's runtime safety check
    return 0xaaaaaaaa;
  }

  endCall(call, args) {
    if (args) {
      this.updateShadowTargets();
      if (args[POINTER_VISITOR]) {
        this.acquirePointerTargets(args);
      }
      this.releaseShadows();
    }
    // restore the previous context if there's one
    this.endContext();
  }

  /* COMPTIME-ONLY */
  beginDefinition() {
    return {};
  }

  insertProperty(def, name, value) {
    def[name] = value;
  }
  /* COMPTIME-ONLY-END */

  /* RUNTIME-ONLY */
  getMemoryOffset(address) {
    // WASM address space starts at 0
    return address;
  }

  recreateAddress(reloc) {
    return reloc;
  }

  invokeThunk(thunkId, args) {
    // wasm-exporter.zig will invoke startCall() with the context address and the args
    // we can't do pointer fix up here since we need the context in order to allocate
    // memory from the WebAssembly allocator; pointer target acquisition will happen in
    // endCall()
    const err = this.runThunk(thunkId, args);
    if (!this.context) {
      this.flushConsole();
    }
    // errors returned by exported Zig functions are normally written into the
    // argument object and get thrown when we access its retval property (a zig error union)
    // error strings returned by the thunk are due to problems in the thunking process
    // (i.e. bugs in export.zig)
    if (err) {
      throwZigError(err);
    }
    return args.retval;
  }
  /* RUNTIME-ONLY */
}
/* WASM-ONLY-END */

export class CallContext {
  pointerProcessed = new Map();
  memoryList = [];
  shadowMap = null;
  /* WASM-ONLY */
  call = 0;
  /* WASM-ONLY-END */
}

export function findSortedIndex(array, value, cb) {
  let low = 0;
  let high = array.length;
  if (high === 0) {
    return 0;
  }
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const value2 = cb(array[mid]);
    if (value2 <= value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return high;
}

function findMemoryIndex(array, address) {
  return findSortedIndex(array, address, m => m.address);
}

function add(address, len) {
  return address + ((typeof(address) === 'bigint') ? BigInt(len) : len);
}

function subtract(address, len) {
  return address - ((typeof(address) === 'bigint') ? BigInt(len) : len);
}

export function isMisaligned(address, align) {
  if (typeof(address) === 'bigint') {
    address = Number(address & 0xFFFFFFFFn);
  }
  const mask = align - 1;
  return (address & mask) !== 0;
}

export function getAlignedAddress(address, align) {
  let mask;
  if (typeof(address) === 'bigint') {
    align = BigInt(align);
    mask = ~(align - 1n);
  } else {
    mask = ~(align - 1);
  }
  return (address & mask) + align;
}