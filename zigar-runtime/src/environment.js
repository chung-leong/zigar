import { resetGlobalErrorSet } from './error-set.js';
import { AlignmentConflict, MustBeOverridden } from './error.js';
import { useBool, useObject } from './member.js';
import { getMemoryCopier } from './memory.js';
import { defineProperties, getMemoryRestorer } from './object.js';
import { addStaticMembers } from './static.js';
import { findAllObjects, getStructureFactory, useArgStruct } from './structure.js';
import {
  ADDRESS_SETTER, ALIGN, CONST_TARGET, COPIER, ENVIRONMENT, FIXED, LENGTH_SETTER, MEMORY,
  MEMORY_RESTORER, POINTER, POINTER_VISITOR, SIZE, SLOTS, TARGET_GETTER, TARGET_UPDATER, TYPE,
  WRITE_DISABLER
} from './symbol.js';
import { decodeText } from './text.js';
import { CallResult, MemberType, MemoryType, StructureType, getStructureName } from './types.js';

export class Environment {
  context;
  contextStack = [];
  consolePending = [];
  consoleTimeout = 0;
  viewMap = new WeakMap();
  emptyBuffer = new ArrayBuffer(0);
  abandoned = false;
  released = false;
  littleEndian = true;
  wordSize = 4;
  runtimeSafety = true;
  comptime = false;
  /* COMPTIME-ONLY */
  slots = {};
  structures = [];
  /* COMPTIME-ONLY-END */
  /* RUNTIME-ONLY */
  variables = [];
  jsFunctionMap = null;
  jsFunctionIdMap = null;
  jsFunctionNextId = 1;
  /* RUNTIME-ONLY-END */
  imports;
  console = globalThis.console;

  /* OVERRIDDEN */
  /* c8 ignore start */
  init() {
    // a mean to provide initialization parameters
    throw new MustBeOverridden();
  }

  getBufferAddress(buffer) {
    // return a buffer's address
    throw new MustBeOverridden();
  }

  allocateHostMemory(len, align) {
    // allocate memory and remember its address
    throw new MustBeOverridden();
  }

  allocateShadowMemory(len, align) {
    // allocate memory for shadowing objects
    throw new MustBeOverridden();
  }

  allocateExternMemory(type, len, align) {
    // allocate external memory
    throw new MustBeOverridden();
  }

  freeHostMemory(address, len, align) {
    // free previously allocated memory
    throw new MustBeOverridden();
  }

  freeShadowMemory(dv) {
    // free memory allocated for shadow
    throw new MustBeOverridden();
  }

  freeExternMemory(type, address, len, align) {
    // free previously allocated external memory
    throw new MustBeOverridden();
  }

  obtainExternView(address, len) {
    // obtain view of memory at specified address
    throw new MustBeOverridden();
  }

  copyBytes(dst, address, len) {
    // copy memory at given address into destination view
    throw new MustBeOverridden();
  }

  findSentinel(address, bytes) {
    // return offset where sentinel value is found
    throw new MustBeOverridden();
  }

  getMemoryOffset(address) {
    // return offset of address relative to start of module memory
    throw new MustBeOverridden();
  }

  recreateAddress(reloc) {
    // recreate address of memory belonging to module
    throw new MustBeOverridden();
  }

  getTargetAddress(target, cluster) {
    // return the address of target's buffer if correctly aligned
    throw new MustBeOverridden();
  }

  createFunctionThunk(funcId) {
    // return the address of JS function thunk
    throw new MustBeOverridden();
  }
  /* c8 ignore end */
  /* OVERRIDDEN-END */

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

  allocateFixedMemory(len, align, type = MemoryType.Normal) {
    const address = (len) ? this.allocateExternMemory(type, len, align) : 0;
    const dv = this.obtainFixedView(address, len);
    dv[FIXED].align = align;
    dv[FIXED].type = type;
    return dv;
  }

  freeFixedMemory(dv) {
    const { address, unalignedAddress, len, align, type } = dv[FIXED];
    if (len) {
      this.freeExternMemory(type, unalignedAddress ?? address, len, align);
    }
  }

  obtainFixedView(address, len) {
    let dv;
    if (address && len) {
      dv = this.obtainExternView(address, len);
    } else {
      // pointer to nothing
      let entry = this.viewMap.get(this.emptyBuffer);
      if (!entry) {
        this.viewMap.set(this.emptyBuffer, entry = {});
      }
      const key = `${address}:0`;
      dv = entry[key];
      if (!dv) {
        dv = entry[key] = new DataView(this.emptyBuffer);
        dv[FIXED] = { address, len: 0 };
      }
    }
    return dv;
  }

  releaseFixedView(dv) {
    // only allocated memory would have type attached
    if (dv[FIXED]?.type !== undefined) {
      this.freeFixedMemory(dv);
      dv[FIXED] = null;
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
    const entry = memoryList[index - 1];
    if (entry?.address === address) {
      memoryList.splice(index - 1, 1);
      return entry.dv;
    }
  }

  findMemory(address, count, size) {
    if (isInvalidAddress(address)) {
      if (!count) {
        address = 0;
      } else {
        return null;
      }
    } else if (!address && count) {
      return null;
    }
    let len = count * (size ?? 0);
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
        const isOpaque = size === undefined;
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
    return this.obtainFixedView(address, len);
  }

  getViewAddress(dv) {
    const fixed = dv[FIXED];
    if (fixed) {
      return fixed.address;
    } else {
      const address = this.getBufferAddress(dv.buffer);
      return add(address, dv.byteOffset);
    }
  }

  findViewAt(buffer, offset, len) {
    let entry = this.viewMap.get(buffer);
    let existing;
    if (entry) {
      if (entry instanceof DataView) {
        // only one view created thus far--see if that's the matching one
        if (entry.byteOffset === offset && entry.byteLength === len) {
          existing = entry;
        } else {
          // no, need to replace the entry with a hash keyed by `offset:len`
          const prev = entry;
          const prevKey = `${prev.byteOffset}:${prev.byteLength}`;
          entry = { [prevKey]: prev };
          this.viewMap.set(buffer, entry);
        }
      } else {
        existing = entry[`${offset}:${len}`];
      }
    }
    return { existing, entry };
  }

  obtainView(buffer, offset, len) {
    const { existing, entry } = this.findViewAt(buffer, offset, len);
    let dv;
    if (existing) {
      return existing;
    } else if (entry) {
      dv = entry[`${offset}:${len}`] = new DataView(buffer, offset, len);
    } else {
      // just one view of this buffer for now
      this.viewMap.set(buffer, dv = new DataView(buffer, offset, len));
    }
    const fixed = buffer[FIXED];
    if (fixed) {
      // attach address to view of fixed buffer
      dv[FIXED] = { address: add(fixed.address, offset), len };
    }
    return dv;
  }

  registerView(dv) {
    if (!dv[FIXED]) {
      const { buffer, byteOffset, byteLength } = dv;
      const { existing, entry } = this.findViewAt(buffer, byteOffset, byteLength);
      if (existing) {
        // return existing view instead of this one
        return existing;
      } else if (entry) {
        entry[`${byteOffset}:${byteLength}`] = dv;
      } else {
        this.viewMap.set(buffer, dv);
      }
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

  castView(address, len, copy, structure) {
    const { constructor, hasPointer } = structure;
    const dv = this.captureView(address, len, copy);
    const object = constructor.call(ENVIRONMENT, dv);
    if (hasPointer) {
      // acquire targets of pointers
      this.updatePointerTargets(object);
    }
    if (copy) {
      object[WRITE_DISABLER]();
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
      isTuple,
      isIterator,
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
      isTuple,
      isIterator,
      hasPointer,
      instance: {
        members: [],
        template: null,
      },
      static: {
        members: [],
        template: null,
      },
    };
  }

  attachMember(structure, member, isStatic = false) {
    const target = (isStatic) ? structure.static : structure.instance;
    target.members.push(member);
  }

  attachTemplate(structure, template, isStatic = false) {
    const target = (isStatic) ? structure.static : structure.instance;
    target.template = template;
  }

  endStructure(structure) {
    this.structures.push(structure);
    this.finalizeStructure(structure);
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
      name: 'ArgFactory',
      byteSize: 2,
      hasPointer: false,
    });
    this.attachMember(structure, {
      type: MemberType.Void,
      name: 'retval',
      bitOffset: 0,
      bitSize: 0,
      byteSize: 0
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
    this.finalizeShape(structure);
    return structure.constructor;
  }

  acquireStructures(options) {
    const {
      omitFunctions = false,
      omitVariables = isElectron(),
    } = options;
    resetGlobalErrorSet();
    const thunkAddress = this.getFactoryThunk();
    const ArgStruct = this.defineFactoryArgStruct();
    const args = new ArgStruct([ { omitFunctions, omitVariables } ]);
    this.comptime = true;
    this.invokeThunk(thunkAddress, thunkAddress, args);
    this.comptime = false;
  }

  getRootModule() {
    const root = this.structures[this.structures.length - 1];
    return root.constructor;
  }

  hasMethods() {
    return !!this.structures.find(s => s.type === StructureType.Function);
  }

  exportStructures() {
    this.acquireDefaultPointers();
    this.prepareObjectsForExport();
    const { structures, runtimeSafety, littleEndian } = this;
    return {
      structures,
      options: { runtimeSafety, littleEndian },
      keys: { MEMORY, SLOTS, CONST_TARGET },
    };
  }

  prepareObjectsForExport() {
    const objects = findAllObjects(this.structures, SLOTS);
    const list = [];
    for (const object of objects) {
      if (object[MEMORY]?.[FIXED]) {
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
    // larger memory blocks come first
    list.sort((a, b) => b.len - a.len);
    for (const a of list) {
      if (!a.replaced) {
        for (const b of list) {
          if (a !== b && !b.replaced) {
            if (a.offset <= b.offset && b.offset < a.offset + a.len) {
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
  }

  useStructures() {
    const module = this.getRootModule();
    // add fixed memory object to list so they can be unlinked
    const objects = findAllObjects(this.structures, SLOTS);
    for (const object of objects) {
      if (object[MEMORY]?.[FIXED]) {
        this.variables.push({ object });
      }
    }
    // clear comptime-only variables
    this.slots = {};
    this.structures = [];
    module.__zigar = this.getSpecialExports();
    return module;
  }
  /* COMPTIME-ONLY-END */

  finalizeShape(structure) {
    const { type, name } = structure;
    const f = getStructureFactory(type);
    const constructor = f(structure, this);
    if (typeof(constructor) === 'function') {
      defineProperties(constructor, {
        name: { value: name, configurable: true },
      });
      if (type !== StructureType.Function && !constructor.prototype.hasOwnProperty(Symbol.toStringTag)) {
        defineProperties(constructor.prototype, {
          [Symbol.toStringTag]: { value: structure.name, configurable: true },
        });
      }
    }
  }

  finalizeStructure(structure) {
    addStaticMembers(structure, this);
  }

  /* RUNTIME-ONLY */
  getFunctionId(fn) {
    if (!this.jsFunctionIdMap) {
      this.jsFunctionIdMap = new WeakMap();
    }
    let id = this.jsFunctionIdMap.get(fn);
    if (id === undefined) {
      id = this.jsFunctionNextId++;
      this.jsFunctionIdMap.set(fn, id);
    }
    return id;
  }

  getFunctionThunk(constructorAddr, funcId) {
    if (!this.jsFunctionThunkMap) {
      this.jsFunctionThunkMap = new Map();
    }
    let dv = this.jsFunctionThunkMap.get(funcId);
    if (dv === undefined) {
      dv = this.runJsThunkConstructor(constructorAddr, funcId);
      if (typeof(dv) === 'string') {
        throw new ZigError(dv);
      }
      this.jsFunctionThunkMap.set(funcId, dv);
    }
    return dv;
  }

  setFunctionCaller(id, caller) {
    if (!this.jsFunctionCallerMap) {
      this.jsFunctionCallerMap = new Map();
    }
    this.jsFunctionCallerMap.set(id, caller);
  }

  runFunction(id, dv, futexHandle) {
    const caller = this.jsFunctionCallerMap.get(id);
    return caller?.(dv, futexHandle) ?? CallResult.Failure;
  }

  recreateStructures(structures, options) {
    Object.assign(this, options);
    const insertObjects = (dest, placeholders) => {
      for (const [ slot, placeholder ] of Object.entries(placeholders)) {
        dest[slot] = createObject(placeholder);
      }
      return dest;
    };
    const createObject = (placeholder) => {
      const { memory, structure, actual } = placeholder;
      if (memory) {
        if (actual) {
          return actual;
        } else {
          const { array, offset, length } = memory;
          const dv = this.obtainView(array.buffer, offset, length);
          const { reloc, const: isConst } = placeholder;
          const constructor = structure?.constructor;
          const object = placeholder.actual = (constructor)
          ? constructor.call(ENVIRONMENT, dv)
          : { [MEMORY]: dv };
          if (isConst) {
            object[WRITE_DISABLER]?.();
          }
          if (placeholder.slots) {
            insertObjects(object[SLOTS], placeholder.slots);
          }
          if (reloc !== undefined) {
            // need to replace dataview with one pointing to fixed memory later,
            // when the VM is up and running
            this.variables.push({ reloc, object });
          }
          return object;
        }
      } else {
        return structure;
      }
    };
    resetGlobalErrorSet();
    const objectPlaceholders = new Map();
    for (const structure of structures) {
      // recreate the actual template using the provided placeholder
      for (const scope of [ structure.instance, structure.static ]) {
        if (scope.template) {
          const { slots, memory, reloc } = scope.template;
          const object = scope.template = {};
          if (memory) {
            const { array, offset, length } = memory;
            object[MEMORY] = this.obtainView(array.buffer, offset, length);
            if (reloc) {
              this.variables.push({ reloc, object });
            }
          }
          if (slots) {
            // defer creation of objects until shapes of structures are finalized
            const realSlots = object[SLOTS] = {};
            objectPlaceholders.set(realSlots, slots);
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
      pointer[ADDRESS_SETTER](address);
      pointer[LENGTH_SETTER]?.(target.length);
    }
  }

  linkObject(object, reloc, writeBack) {
    if (object[MEMORY][FIXED]) {
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
    if (!object[MEMORY][FIXED]) {
      return;
    }
    /* WASM-ONLY */
    object[MEMORY_RESTORER]?.();
    /* WASM-ONLY-END */
    const dv = object[MEMORY];
    const relocDV = this.allocateMemory(dv.byteLength);
    if (object[COPIER]) {
      const dest = Object.create(object.constructor.prototype);
      dest[MEMORY] = relocDV;
      dest[COPIER](object);
    }
    object[MEMORY] = relocDV;
  }

  releaseFunctions() {
    const throwError = () => { throw new Error(`Module was abandoned`) };
    for (const name of Object.keys(this.imports)) {
      if (this[name]) {
        this[name] = throwError;
      }
    }
  }

  getSpecialExports() {
    const check = (v) => {
      if (v === undefined) throw new Error('Not a Zig type');
      return v;
    };
    return {
      init: (...args) => this.init(...args),
      abandon: () => this.abandon(),
      released: () => this.released,
      connect: (console) => this.console = console,
      multithread: (enable) => this.setMultithread(enable),
      sizeOf: (T) => check(T[SIZE]),
      alignOf: (T) => check(T[ALIGN]),
      typeOf: (T) => getStructureName(check(T[TYPE])),
    };
  }

  abandon() {
    if (!this.abandoned) {
      this.setMultithread(false);
      this.releaseFunctions();
      this.unlinkVariables();
      this.abandoned = true;
    }
  }

  updatePointerAddresses(args) {
    // first, collect all the pointers
    const pointerMap = new Map();
    const bufferMap = new Map();
    const potentialClusters = [];
    const env = this;
    const callback = function({ isActive }) {
      if (isActive(this)) {
        // bypass proxy
        const pointer = this[POINTER];
        if (!pointerMap.get(pointer)) {
          const target = pointer[SLOTS][0];
          if (target) {
            pointerMap.set(pointer, target);
            // only relocatable targets need updating
            const dv = target[MEMORY];
            if (!dv[FIXED]) {
              // see if the buffer is shared with other objects
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
      const address = this.getTargetAddress(target, cluster) ?? this.getShadowAddress(target, cluster);
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
    const maxAlignAddress = getAlignedAddress(add(unalignedAddress, maxAlignOffset - start), maxAlign);
    const shadowAddress = add(maxAlignAddress, start - maxAlignOffset);
    const shadowOffset = unalignedShadowDV.byteOffset + Number(shadowAddress - unalignedAddress);
    const shadowDV = new DataView(unalignedShadowDV.buffer, shadowOffset, len);
    // make sure that other pointers are correctly aligned also
    for (const target of targets) {
      const dv = target[MEMORY];
      const offset = dv.byteOffset;
      if (offset !== maxAlignOffset) {
        const align = target.constructor[ALIGN] ?? dv[ALIGN];
        if (isMisaligned(add(shadowAddress, offset - start), align)) {
          throw new AlignmentConflict(align, maxAlign);
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
    /* WASM-ONLY */
    // attach fixed memory info to aligned data view so it gets freed correctly
    shadowDV[FIXED] = { address: shadowAddress, len, align: 1, unalignedAddress, type: MemoryType.Scratch };
    /* WASM-ONLY-END */
    return this.addShadow(shadow, source, 1);
  }
  /* RUNTIME-ONLY-END */

  getShadowAddress(target, cluster) {
    if (cluster) {
      const dv = target[MEMORY];
      if (cluster.address === undefined) {
        const shadow = this.createClusterShadow(cluster);
        cluster.address = this.getViewAddress(shadow[MEMORY]);
      }
      return add(cluster.address, dv.byteOffset - cluster.start);
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
    shadow[MEMORY] = this.allocateShadowMemory(dv.byteLength, align);
    return this.addShadow(shadow, object, align);
  }

  addShadow(shadow, object, align) {
    const shadowMap = this.context.shadowMap ??= new Map();
    /* WASM-ONLY */
    shadow[MEMORY_RESTORER] = getMemoryRestorer(null, this);
    /* WASM-ONLY-END */
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
      this.freeShadowMemory(shadow[MEMORY]);
    }
  }

  updatePointerTargets(args) {
    const pointerMap = new Map();
    const callback = function({ isActive, isMutable }) {
      // bypass proxy
      const pointer = this[POINTER] ?? this;
      if (!pointerMap.get(pointer)) {
        pointerMap.set(pointer, true);
        const writable = !pointer.constructor.const;
        const currentTarget = pointer[SLOTS][0];
        const newTarget = (!currentTarget || isMutable(this))
        ? pointer[TARGET_UPDATER](true, isActive(this))
        : currentTarget;
        // update targets of pointers in original target (which could have been altered)
        currentTarget?.[POINTER_VISITOR]?.(callback, { vivificate: true, isMutable: () => writable });
        if (newTarget !== currentTarget) {
          // acquire targets of pointers in new target
          newTarget?.[POINTER_VISITOR]?.(callback, { vivificate: true, isMutable: () => writable });
        }
      }
    }
    args[POINTER_VISITOR](callback, { vivificate: true });
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

  /* COMPTIME-ONLY */
  acquireDefaultPointers() {
    for (const structure of this.structures) {
      const { constructor, hasPointer, instance: { template } } = structure;
      if (hasPointer && template && template[MEMORY]) {
        // create a placeholder for retrieving default pointers
        const placeholder = Object.create(constructor.prototype);
        placeholder[MEMORY] = template[MEMORY];
        placeholder[SLOTS] = template[SLOTS];
        this.updatePointerTargets(placeholder);
      }
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

export function isInvalidAddress(address) {
  if (typeof(address) === 'bigint') {
    return address === 0xaaaaaaaaaaaaaaaan;
  } else {
    return address === 0xaaaaaaaa;
  }
}

function isElectron() {
  return typeof(process) === 'object'
      && typeof(process?.versions) === 'object'
      && !!process.versions?.electron;
}
