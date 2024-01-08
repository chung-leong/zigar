import { defineProperties, findAllObjects, getStructureFactory, getStructureName } from './structure.js';
import { decodeText } from './text.js';
import { initializeErrorSets } from './error-set.js';
import { throwAlignmentConflict, throwZigError } from './error.js';
import { getMemoryCopier } from './memory.js';
import { addStaticMembers } from './static.js';
import { addMethods } from './method.js';
import { ADDRESS_GETTER, ADDRESS_SETTER, ALIGN, CONST, ENVIRONMENT, LENGTH_GETTER, LENGTH_SETTER, 
  MEMORY, MEMORY_COPIER, POINTER_SELF, POINTER_VISITOR, SENTINEL, SHADOW_ATTRIBUTES, SIZE, 
  SLOTS } from './symbol.js';

const OMIT_FUNCTIONS = 0x00000001;

export class Environment {
  context;
  contextStack = [];
  consolePending = [];
  consoleTimeout = 0;
  viewMap = new WeakMap();
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
  allocateRelocMemory(len: number, align: number): DataView {
    // allocate memory and remember its address
  }
  allocateShadowMemory(len: number, align: number): DataView {
    // allocate memory for shadowing objects
  }
  freeRelocMemory(address: bigint|number, len: number, align: number): void {
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
  releaseFixedView(dv: DataView): void {
    // release allocated memory stored in data view, doing nothing if data view 
    // does not contain fixed memory or if memory is static
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

  allocateMemory(len, align = 0, fixed = false) {
    if (fixed) {
      return this.allocateFixedMemory(len, align);
    } else {
      return this.obtainView(new ArrayBuffer(len), 0, len);
    }
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
    if (this.context) {
      const { memoryList, shadowMap } = this.context;
      const index = findMemoryIndex(memoryList, address);
      const prev = memoryList[index - 1];
      if (prev?.address === address && prev.len === len) {
        return prev.targetDV ?? prev.dv;
      } else if (prev?.address <= address && address < add(prev.address, prev.len)) {
        const offset = Number(address - prev.address) + prev.dv.byteOffset;
        const dv = prev.targetDV ?? prev.dv;
        return this.obtainView(dv.buffer, dv.byteOffset + offset, len);
      }
    }
    // not found in any of the buffers we've seen--assume it's fixed memory
    return this.obtainFixedView(address, len);
  }

  getViewAddress(dv) {
    const address = this.getBufferAddress(dv.buffer);
    return add(address, dv.byteOffset);
  }

  obtainView(buffer, offset, len) {
    let entry = this.viewMap.get(buffer);
    if (!entry) {
      const dv = new DataView(buffer, offset, len);
      this.viewMap.set(buffer, dv);
      return dv;
    } 
    if (entry instanceof DataView) {
      // only one view created thus far--see if that's the matching one 
      if (entry.byteOffset === offset && entry.byteLength === len) {
        return entry;
      } else {
        // no, need to replace the entry with a hash keyed by `offset:len`
        const dv = entry;
        const key = `${dv.byteOffset}:${dv.byteLength}`;
        entry = { [key]: dv };
        this.viewMap.set(buffer, entry);
      }
    }
    const key = `${offset}:${len}`;
    let dv = entry[key];
    if (!dv) {
      dv = entry[key] = new DataView(buffer, offset, len);
    }
    return dv;
  }

  captureView(address, len, copy) {
    if (copy) {
      const dv = this.allocateMemory(len);
      if (len > 0) {
        this.copyBytes(dv, address, len);
      }
      return dv;
    } else {
      return this.obtainFixedView(address, len);
    }
  }

  castView(structure, dv, writable) {
    const { constructor, hasPointer } = structure;
    const object = constructor.call(ENVIRONMENT, dv, { writable });
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
    this.finalizeStructure(s);
    for (const s of this.structures) {
      this.acquireDefaultPointers(s);
    }
  }

  acquireStructures(options) {
    const {
      omitFunctions = false,
    } = options;
    initializeErrorSets();
    const arg = new DataView(new ArrayBuffer(4));
    let flags = 0;
    if (omitFunctions) {
      flags |= OMIT_FUNCTIONS;
    }
    arg.setUint32(0, flags, true);
    const result = this.defineStructures(arg);
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
    const { structures } = this;
    return { structures, keys: { MEMORY, SLOTS, CONST } };
  }

  prepareObjectsForExport() {
    const objects = findAllObjects(this.structures, SLOTS);    
    const list = [];
    for (const object of objects) {
      if (object[MEMORY]) {
        let dv = object[MEMORY];
        if (this.inFixedMemory(object)) {
          // replace fixed memory
          const address = this.getViewAddress(dv);
          const offset = this.getMemoryOffset(address);
          const len = dv.byteLength;
          const relocDV = this.captureView(address, len, true);
          relocDV.reloc = offset;
          object[MEMORY] = relocDV;
          list.push({ offset, len, owner: object, replaced: false });
        }
      }
    }
    // larger memory blocks come first
    list.sort((a, b) => b.len - a.len);
    for (const a of list) {
      for (const b of list) {
        if (a !== b && !a.replaced) {
          if (a.offset <= b.offset && b.offset + b.len <= a.offset + a.len) {
            // B is inside A--replace it with a view of A's buffer
            const dv = a.owner[MEMORY];
            const pos = b.offset - a.offset + dv.byteOffset;
            const newDV = this.obtainView(dv.buffer, pos, b.len);
            newDV.reloc = b.offset;
            b.owner[MEMORY] = newDV;
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
      const name = getStructureName(s);
      defineProperties(constructor, {
        name: { value: name, configurable: true },
      });
      if (!constructor.prototype.hasOwnProperty(Symbol.toStringTag)) {
        defineProperties(constructor.prototype, {
          [Symbol.toStringTag]: { value: s.name, configurable: true },
        });
      }
    }
  }

  finalizeStructure(s) {
    addStaticMembers(s, this);
    addMethods(s, this);
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
    const insertObjects = (dest, placeholders) => {
      for (const [ slot, placeholder ] of Object.entries(placeholders)) {
        dest[slot] = placeholder ? createObject(placeholder) : null;
      }
      return dest;
    };
    const createObject = (placeholder) => {
      if (placeholder.memory) {
        const { array, offset, length } = placeholder.memory;
        const dv = this.obtainView(array.buffer, offset, length);
        const { constructor } = placeholder.structure;
        const { reloc, const: isConst } = placeholder;
        const writable = reloc !== undefined && isConst !== true;
        const object = constructor.call(ENVIRONMENT, dv, { writable });
        if (placeholder.slots) {
          insertObjects(object[SLOTS], placeholder.slots);
        }
        if (reloc !== undefined) {
          // need to replace dataview with one pointing to fixed memory later,
          // when the VM is up and running
          this.variables.push({ reloc, object });
        }
        return object;  
      } else {
        return placeholder.structure;
      }
    };
    initializeErrorSets();
    const objectPlaceholders = new Map();
    for (const structure of structures) {
      // recreate the actual template using the provided placeholder
      for (const scope of [ structure.instance, structure.static ]) {
        if (scope.template) {
          const placeholder = scope.template;
          const template = scope.template = {};
          if (placeholder.memory) {
            const { array, offset, length } = placeholder.memory;
            template[MEMORY] = this.obtainView(array.buffer, offset, length);
          }
          if (placeholder.slots) {
            // defer creation of objects until shapes of structures are finalized
            const slots = template[SLOTS] = {};
            objectPlaceholders.set(slots, placeholder.slots); 
          }   
        }
      }
      this.finalizeShape(structure);
    }
    // insert objects into template slots
    for (const [ slots, placeholders ] of objectPlaceholders) {
      insertObjects(slots, placeholders);
    }
    // add static members, methods, etc.
    for (const structure of structures) {
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
    const relocDV = this.allocateMemory(dv.byteLength);
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
      } else {
        pointerMap.set(pointer, true);
      }
      const Target = pointer.constructor.child;
      const writable = !pointer.constructor.const;
      let target = this[SLOTS][0];
      if (!target || isMutable(this)) {
        // obtain address (and possibly length) from memory
        const address = pointer[ADDRESS_GETTER]();
        let len = pointer[LENGTH_GETTER]?.();
        if (len === undefined) {
          const sentinel = Target[SENTINEL];
          if (sentinel) {
            len = (address) ? env.findSentinel(address, sentinel.bytes) + 1 : 0;
          } else {
            len = 1;
          }
        }
        // get view of memory that pointer points to
        const byteLength = len * Target[SIZE];
        const dv = env.findMemory(address, byteLength);
        // create the target
        target = this[SLOTS][0] = Target.call(this, dv, { writable });
      }
      if (target?.[POINTER_VISITOR]) {
        // acquire objects pointed to by pointers in target
        const isMutable = () => writable;
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

export function add(address, len) {
  return address + ((typeof(address) === 'bigint') ? BigInt(len) : len);
}

export function subtract(address, len) {
  return address - ((typeof(address) === 'bigint') ? BigInt(len) : len);
}
