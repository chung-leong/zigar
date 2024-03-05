import { createGlobalErrorSet } from './error-set.js';
import { throwAlignmentConflict } from './error.js';
import { MemberType, useBool, useObject } from './member.js';
import { getMemoryCopier } from './memory.js';
import { addMethods } from './method.js';
import { addStaticMembers } from './static.js';
import {
  StructureType, defineProperties, findAllObjects, getStructureFactory, useArgStruct
} from './structure.js';
import {
  ALIGN, ATTRIBUTES, CONST, COPIER, ENVIRONMENT, FIXED_LOCATION, LOCATION_GETTER, LOCATION_SETTER,
  MEMORY, POINTER, POINTER_VISITOR, SIZE, SLOTS, TARGET_GETTER
} from './symbol.js';
import { decodeText } from './text.js';

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
  comptime = false;
  /* COMPTIME-ONLY */
  slots = {};
  structures = [];
  /* COMPTIME-ONLY-END */
  /* RUNTIME-ONLY */
  variables = [];
  /* RUNTIME-ONLY-END */
  imports;
  console = globalThis.console;

  /*
  Functions to be defined in subclass:

  getBufferAddress(buffer: ArrayBuffer): bigint|number {
    // return a buffer's address
  }
  allocateHostMemory(len: number, align: number): DataView {
    // allocate memory and remember its address
  }
  allocateShadowMemory(len: number, align: number): DataView {
    // allocate memory for shadowing objects
  }
  freeHostMemory(address: bigint|number, len: number, align: number): void {
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
      return this.allocateRelocMemory(len, align);
    }
  }

  allocateRelocMemory(len, align) {
    return this.obtainView(new ArrayBuffer(len), 0, len);
  }

  registerMemory(dv, targetDV = null, targetAlign = undefined) {
    const { memoryList } = this.context;
    const address = this.getViewAddress(dv);
    const index = findMemoryIndex(memoryList, address);
    memoryList.splice(index, 0, { address, dv, len: dv.byteLength, targetDV, targetAlign });
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
      const { memoryList } = this.context;
      const index = findMemoryIndex(memoryList, address);
      const entry = memoryList[index - 1];
      if (entry?.address === address && entry.len === len) {
        return entry.targetDV ?? entry.dv;
      } else if (entry?.address <= address && address < add(entry.address, entry.len)) {
        const offset = Number(address - entry.address);
        const targetDV = entry.targetDV ?? entry.dv;
        const isOpaque = len === undefined;
        if (isOpaque) {
          len = targetDV.byteLength - offset;
        }
        const dv = this.obtainView(targetDV.buffer, targetDV.byteOffset + offset, len);
        if (isOpaque) {
          // opaque structure--need to save the alignment 
          dv[ALIGN] = entry.targetAlign;
        }
        return dv;
      }
    }
    // not found in any of the buffers we've seen--assume it's fixed memory
    return this.obtainFixedView(address, len ?? 0);
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
      // copy content into reloctable memory
      const dv = this.allocateRelocMemory(len, 0);
      if (len > 0) {
        this.copyBytes(dv, address, len);
      }
      return dv;
    } else {
      // link into fixed memory
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

  attachMember(structure, member, isStatic = false) {
    const target = (isStatic) ? structure.static : structure.instance;
    target.members.push(member);
  }

  attachMethod(structure, method, isStaticOnly = false) {
    structure.static.methods.push(method);
    if (!isStaticOnly) {
      structure.instance.methods.push(method);
    }
  }

  attachTemplate(structure, template, isStatic = false) {
    const target = (isStatic) ? structure.static : structure.instance;
    target.template = template;
  }

  endStructure(structure) {
    this.structures.push(structure);
    this.finalizeStructure(structure);
    for (const structure of this.structures) {
      this.acquireDefaultPointers(structure);
    }
  }

  defineFactoryArgStruct() {
    useBool();
    useObject();
    useArgStruct();
    const options = this.beginStructure({
      type: StructureType.Struct,
      name: 'Options',
      byteSize: 2,
      hasPointer: false,
    })
    this.attachMember(options, {
      type: MemberType.Bool,
      name: 'omitFunctions',
      bitOffset: 0,
      bitSize: 1,
      byteSize: 1,      
    });
    this.attachMember(options, {
      type: MemberType.Bool,
      name: 'omitVariables',
      bitOffset: 8,
      bitSize: 1,
      byteSize: 1,      
    });
    this.finalizeShape(options);
    const structure = this.beginStructure({
      type: StructureType.ArgStruct,
      name: 'factory',
      byteSize: 2,
      hasPointer: false,
    });
    this.attachMember(structure, {
      type: MemberType.Object,
      name: '0',
      bitOffset: 0,
      bitSize: 16,
      byteSize: 2,
      slot: 0,
      structure: options,
    });
    this.attachMember(structure, {
      type: MemberType.Void,
      name: 'retval',
      bitOffset: 16,
      bitSize: 0,
      byteSize: 0
    });
    this.finalizeShape(structure);
    return structure.constructor;
  }

  acquireStructures(options) {
    const {
      omitFunctions = false,
      omitVariables = isElectron(),
    } = options;
    createGlobalErrorSet();
    const thunkId = this.getFactoryThunk();
    const ArgStruct = this.defineFactoryArgStruct();
    const args = new ArgStruct([ { omitFunctions, omitVariables } ]);
    this.comptime = true;
    this.invokeThunk(thunkId, args);
    this.comptime = false;
  }

  getRootModule() {
    const root = this.structures[this.structures.length - 1];
    return root.constructor;
  }

  hasMethods() {
    // all methods are static, so there's no need to check instance methods
    return !!this.structures.find(s => s.static.methods.length > 0);
  }

  exportStructures() {
    this.prepareObjectsForExport();
    const { structures, runtimeSafety, littleEndian } = this;
    return { 
      structures, 
      options: { runtimeSafety, littleEndian }, 
      keys: { MEMORY, SLOTS, CONST } 
    };
  }

  prepareObjectsForExport() {
    const objects = findAllObjects(this.structures, SLOTS);    
    const list = [];
    for (const object of objects) {
      if (object[MEMORY]) {
        if (this.inFixedMemory(object)) {
          // replace fixed memory
          const dv = object[MEMORY];
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

  useStructures() {
    const module = this.getRootModule();
    // add fixed memory object to list so they can be unlinked
    const objects = findAllObjects(this.structures, SLOTS);    
    for (const object of objects) {
      if (object[MEMORY] && this.inFixedMemory(object)) {
        this.variables.push({ object });
      }
    }
    // clear comptime-only variables
    this.slots = {};
    this.structures = [];
    module.__zigar = this.getControlObject();
    return module;
  }
  /* COMPTIME-ONLY-END */

  finalizeShape(structure) {
    const f = getStructureFactory(structure.type);
    const constructor = f(structure, this);
    if (typeof(constructor) === 'function') {
      defineProperties(constructor, {
        name: { value: structure.name, configurable: true },
      });
      if (!constructor.prototype.hasOwnProperty(Symbol.toStringTag)) {
        defineProperties(constructor.prototype, {
          [Symbol.toStringTag]: { value: structure.name, configurable: true },
        });
      }
    }
  }

  finalizeStructure(structure) {
    addStaticMembers(structure, this);
    addMethods(structure, this);
  }

  createCaller(method, useThis) {
    const { name, argStruct, thunkId } = method;
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
  recreateStructures(structures, options) {
    Object.assign(this, options);
    const insertObjects = (dest, placeholders) => {
      for (const [ slot, placeholder ] of Object.entries(placeholders)) {
        dest[slot] = createObject(placeholder);
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
    createGlobalErrorSet();
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
    const pointers = [];
    for (const { object, reloc } of this.variables) {
      this.linkObject(object, reloc, writeBack);
      const getter = object[TARGET_GETTER];
      if (getter && object[SLOTS][0]) {
        pointers.push(object);
      }
    }
    // save locations of pointer targets
    for (const pointer of pointers) {
      const target = pointer[TARGET_GETTER]();
      const address = this.getViewAddress(target[MEMORY]);
      const { length = 1 } = target;
      pointer[FIXED_LOCATION] = { address, length };
    }
  }

  linkObject(object, reloc, writeBack) {
    if (this.inFixedMemory(object)) {
      return;
    }
    const dv = object[MEMORY];
    const address = this.recreateAddress(reloc);
    const fixedDV = this.obtainFixedView(address, dv.byteLength);
    if (writeBack) {
      const dest = Object.create(object.constructor.prototype);
      dest[MEMORY] = fixedDV;
      dest[COPIER](object);
    }
    object[MEMORY] = fixedDV;
    const linkChildren = (object) => {
      if (object[SLOTS]) {
        for (const child of Object.values(object[SLOTS])) {
          if (child) {
            const childDV = child[MEMORY];
            if (childDV.buffer === dv.buffer) {
              const offset = childDV.byteOffset - dv.byteOffset;
              child[MEMORY] = this.obtainView(fixedDV.buffer, offset, childDV.byteLength);
              linkChildren(child); 
            }
          }
        }
      }
    };
    linkChildren(object);
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
    dest[COPIER](object);
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
      connect: (c) => this.console = c,
    };
  }

  abandon() {
    if (!this.abandoned) {
      this.releaseFunctions();
      this.unlinkVariables();
      this.abandoned = true;
    }
  }

  writeToConsole(dv) {
    const { console } = this;
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
      const pointer = this[POINTER];
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
      const { length = 1 } = target;
      let address = this.getTargetAddress(target, cluster);
      if (address === false) {
        // need to shadow the object
        address = this.getShadowAddress(target, cluster);
      }
      // update the pointer
      pointer[LOCATION_SETTER]({ address, length });
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

  createClusterShadow(cluster) {
    const { start, end, targets } = cluster;
    // look for largest align
    let maxAlign = 0, maxAlignOffset;
    for (const target of targets) {
      const dv = target[MEMORY];
      const offset = dv.byteOffset;
      const align = target.constructor[ALIGN] ?? dv[ALIGN];
      if (maxAlign === undefined || align > maxAlign) {
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
      const dv = target[MEMORY];
      const offset = dv.byteOffset;
      if (offset !== maxAlignOffset) {
        const align = target.constructor[ALIGN] ?? dv[ALIGN];
        if (isMisaligned(add(shadowAddress, offset), align)) {
          throwAlignmentConflict(align, maxAlign);
        }
      }
    }
    // placeholder object type
    const prototype = {
      [COPIER]: getMemoryCopier(len)
    };
    const source = Object.create(prototype);
    const shadow = Object.create(prototype);
    source[MEMORY] = new DataView(targets[0][MEMORY].buffer, Number(start), len);
    shadow[MEMORY] = shadowDV;
    shadow[ATTRIBUTES] = {
      address: unalignedAddress,
      len: unalignedShadowDV.byteLength,
      align: 1,
    };
    return this.addShadow(shadow, source, align);
  }
  /* RUNTIME-ONLY-END */

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
    // use the alignment of the structure; in the case of an opaque pointer's target,
    // try to the alignment specified when the memory was allocated
    const align = object.constructor[ALIGN] ?? dv[ALIGN];
    const shadow = Object.create(object.constructor.prototype);
    const shadowDV = shadow[MEMORY] = this.allocateShadowMemory(dv.byteLength, align);
    shadow[ATTRIBUTES] = {
      address: this.getViewAddress(shadowDV),
      len: shadowDV.byteLength,
      align,
    };
    return this.addShadow(shadow, object, align);
  }

  addShadow(shadow, object, align) {
    let { shadowMap } = this.context;
    if (!shadowMap) {
      shadowMap = this.context.shadowMap = new Map();
    }
    shadowMap.set(shadow, object);
    this.registerMemory(shadow[MEMORY], object[MEMORY], align);
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
      shadow[COPIER](object);
    }
  }

  updateShadowTargets() {
    const { shadowMap } = this.context;
    if (!shadowMap) {
      return;
    }
    for (const [ shadow, object ] of shadowMap) {
      object[COPIER](shadow);
    }
  }

  releaseShadows() {
    const { shadowMap } = this.context;
    if (!shadowMap) {
      return;
    }
    for (const [ shadow ] of shadowMap) {
      const { address, len, align } = shadow[ATTRIBUTES];
      this.freeShadowMemory(address, len, align);
    }
  }

  acquirePointerTargets(args) {
    const env = this;
    const pointerMap = new Map();
    const callback = function({ isActive, isMutable }) {
      const pointer = this[POINTER];
      if (pointerMap.get(pointer)) {
        return;
      } else {
        pointerMap.set(pointer, true);
      }
      const writable = !pointer.constructor.const;
      const currentTarget = pointer[SLOTS][0];
      let newTarget, location;
      if (isActive(this)) {
        const Target = pointer.constructor.child;
        if (!currentTarget || isMutable(this)) {
          // obtain address and length from memory
          location = pointer[LOCATION_GETTER]();
          // get view of memory that pointer points to
          const len = (Target[SIZE] !== undefined) ? location.length * Target[SIZE] : undefined;
          const dv = env.findMemory(location.address, len);
          // create the target
          newTarget = Target.call(ENVIRONMENT, dv, { writable });
        } else {
          newTarget = currentTarget;
        }
      }
      // acquire objects pointed to by pointers in target
      currentTarget?.[POINTER_VISITOR]?.(callback, { vivificate: true, isMutable: () => writable });
      if (newTarget !== currentTarget) {
        newTarget?.[POINTER_VISITOR]?.(callback, { vivificate: true, isMutable: () => writable });
        pointer[SLOTS][0] = newTarget;
        if (env.inFixedMemory(pointer)) {
          pointer[FIXED_LOCATION] = location;
        }
      }
    }
    args[POINTER_VISITOR](callback, { vivificate: true });
  }

  /* COMPTIME-ONLY */
  acquireDefaultPointers(structure) {
    const { constructor, hasPointer, instance: { template } } = structure;
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
  if (align === undefined) {
    return false;
  }
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

function isElectron() {
  return typeof(process) === 'object'
      && typeof(process?.versions) === 'object' 
      && !!process.versions?.electron;
}
