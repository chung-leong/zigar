import { SENTINEL, SLOTS, MEMORY, ZIG, PROPS, VISIT, ENVIRONMENT } from '../symbols.js';
import { SliceFlag, StructureType, PointerFlag, ErrorSetFlag, StructFlag, MemberType, PrimitiveFlag, structureNames, ModuleAttribute, StructureFlag } from '../constants.js';
import { mixin } from '../environment.js';
import './call-marshaling-inbound.js';
import './call-marshaling-outbound.js';
import './dir-conversion.js';
import './module-loading.js';
import './pointer-synchronization.js';
import './reader-conversion.js';
import './thunk-allocation.js';
import './writer-conversion.js';
import '../structures/abort-signal.js';
import '../structures/allocator.js';
import '../structures/dir.js';
import '../structures/file.js';
import '../structures/generator.js';
import '../structures/promise.js';
import '../structures/reader.js';
import '../structures/writer.js';
import '../syscalls/environ-get.js';
import '../syscalls/environ-sizes-get.js';
import '../syscalls/fd-advise.js';
import '../syscalls/fd-allocate.js';
import '../syscalls/fd-close.js';
import '../syscalls/fd-datasync.js';
import '../syscalls/fd-fdstat-get.js';
import '../syscalls/fd-fdstat-set-flags.js';
import '../syscalls/fd-fdstat-set-rights.js';
import '../syscalls/fd-filestat-get.js';
import '../syscalls/fd-filestat-set-times.js';
import '../syscalls/fd-pread.js';
import '../syscalls/fd-prestat-dir-name.js';
import '../syscalls/fd-prestat-get.js';
import '../syscalls/fd-pwrite.js';
import '../syscalls/fd-read.js';
import '../syscalls/fd-readdir.js';
import '../syscalls/fd-seek.js';
import '../syscalls/fd-sync.js';
import '../syscalls/fd-tell.js';
import '../syscalls/fd-write.js';
import '../syscalls/path-create-directory.js';
import '../syscalls/path-filestat-get.js';
import '../syscalls/path-filestat-set-times.js';
import '../syscalls/path-open.js';
import '../syscalls/path-remove-directory.js';
import '../syscalls/path-unlink-file.js';
import '../syscalls/poll-oneoff.js';
import '../syscalls/proc-exit.js';
import '../syscalls/random-get.js';
import { decodeText, findObjects, adjustAddress } from '../utils.js';
import './baseline.js';
import './object-linkage.js';
import './stream-location.js';
import './stream-redirection.js';
import './worker-support.js';

var structureAcquisition = mixin({
  init() {
    this.comptime = false;
    this.slots = {};
    this.structures = [];
    this.structureCounters = {
      struct: 0,
      union: 0,
      errorSet: 0,
      enum: 0,
      opaque: 0,
    };
    this.littleEndian = true;
    this.runtimeSafety = false;
    this.ioRedirection = true;
    this.libc = false;
  },
  createView(address, len, copy, handle) {
    if (copy) {
      // copy content into JavaScript memory
      const dv = this.allocateJSMemory(len, 0);
      if (len > 0) {
        this.moveExternBytes(dv, address, false);
      }
      return dv;
    } else {
      // link into Zig memory
      const dv = this.obtainZigView(address, len);
      {
        dv[ZIG].handle = address;
      }
      return dv;
    }
  },
  createInstance(structure, dv, slots) {
    const { constructor } = structure;
    const object = constructor.call(ENVIRONMENT, dv);
    if (slots) {
      Object.assign(object[SLOTS], slots);
    }
    if (!dv[ZIG]) {
      this.makeReadOnly?.(object);
    }
    return object;
  },
  createTemplate(dv, slots) {
    return { [MEMORY]: dv, [SLOTS]: slots };
  },
  appendList(list, element) {
    list.push(element);
  },
  getSlotValue(slots, slot) {
    if (!slots) slots = this.slots;
    return slots[slot];
  },
  setSlotValue(slots, slot, value) {
    if (!slots) slots = this.slots;
    slots[slot] = value;
  },
  beginStructure(structure) {
    this.defineStructure(structure);
  },
  finishStructure(structure) {
    if (!structure.name) {
      this.inferTypeName(structure);
    }
    this.structures.push(structure);
    this.finalizeStructure(structure);
  },
  acquireStructures() {
    const attrs = this.getModuleAttributes();
    this.littleEndian = !!(attrs & ModuleAttribute.LittleEndian);
    this.runtimeSafety = !!(attrs & ModuleAttribute.RuntimeSafety);
    this.ioRedirection = !!(attrs & ModuleAttribute.IoRedirection);
    this.libc = !!(attrs & ModuleAttribute.LibC);
    const thunkAddress = this.getFactoryThunk();
    const thunk = { [MEMORY]: this.obtainZigView(thunkAddress, 0) };
    this.comptime = true;
    this.mixinUsage = new Map();
    this.invokeThunk(thunk, thunk, thunk);
    this.comptime = false;
    // acquire pointer targets now that we have all constructors
    for (const structure of this.structures) {
      const { constructor, flags, instance: { template } } = structure;
      // update decls that are pointers
      for (const name of constructor[PROPS]) {
        try {
          const decl = constructor[name];
          if (decl?.[VISIT]) {
            this.updatePointerTargets(null, decl);
          }
        } catch {}
      }
      // update default values held in template
      if (flags & StructureFlag.HasPointer && template && template[MEMORY]) {
        // create a placeholder object
        const placeholder = Object.create(constructor.prototype);
        placeholder[MEMORY] = template[MEMORY];
        placeholder[SLOTS] = template[SLOTS];
        this.updatePointerTargets(null, placeholder);
      }
    }
  },
  getRootModule() {
    const root = this.structures[this.structures.length - 1];
    return root.constructor;
  },
  hasMethods() {
    return !!this.structures.find(s => s.type === StructureType.Function);
  },
  exportStructures() {
    this.prepareObjectsForExport();
    const { structures, runtimeSafety, littleEndian, ioRedirection, libc } = this;
    return {
      structures,
      settings: { runtimeSafety, littleEndian, ioRedirection, libc },
    };
  },
  prepareObjectsForExport() {
    const list = [];
    for (const object of findObjects(this.structures, SLOTS)) {
      const zig = object[MEMORY]?.[ZIG];
      if (zig) {
        // replace Zig memory
        const { address, len, handle } = zig;
        const jsDV = object[MEMORY] = this.createView(address, len, true, 0);
        if (handle) {
          jsDV.handle = handle;
        }
        list.push({ address, len, owner: object, replaced: false, handle });
      }
    }
    // larger memory blocks come first
    list.sort((a, b) => b.len - a.len);
    for (const a of list) {
      if (!a.replaced) {
        for (const b of list) {
          if (a !== b && !b.replaced && !b.handle) {
            if (a.address <= b.address && adjustAddress(b.address, b.len) <= adjustAddress(a.address, a.len)) {
              // B is inside A--replace it with a view of A's buffer
              const dvA = a.owner[MEMORY];
              const pos = Number(b.address - a.address) + dvA.byteOffset;
              b.owner[MEMORY] = this.obtainView(dvA.buffer, pos, b.len);
              b.replaced = true;
            }
          }
        }
      }
    }
  },
  useStructures() {
    const module = this.getRootModule();
    // add Zig memory object to list so they can be unlinked
    const objects = findObjects(this.structures, SLOTS);
    for (const object of objects) {
      if (object[MEMORY]?.[ZIG]) {
        this.variables.push({ object });
      }
    }
    // clear comptime-only variables
    this.slots = {};
    this.structures = [];
    module.__zigar = this.getSpecialExports();
    return module;
  },
  inferTypeName(s) {
    const handlerName = `get${structureNames[s.type]}Name`;
    const handler = this[handlerName];
    s.name = handler.call(this, s);
  },
  getPrimitiveName(s) {
    const { instance: { members: [member] }, flags = 0 } = s;
    switch (member.type) {
      case MemberType.Bool:
        return `bool`;
      case MemberType.Int:
        return (flags & PrimitiveFlag.IsSize) ? `isize` : `i${member.bitSize}`;
      case MemberType.Uint:
        return (flags & PrimitiveFlag.IsSize) ? `usize` : `u${member.bitSize}`;
      case MemberType.Float:
        return `f${member.bitSize}`;
      case MemberType.Void:
        return 'void';
      case MemberType.Literal:
        return 'enum_literal';
      case MemberType.Null:
        return 'null';
      case MemberType.Undefined:
        return 'undefined';
      case MemberType.Type:
        return 'type';
      case MemberType.Object:
        return 'comptime';
      default:
        return 'unknown';
    }
  },
  getArrayName(s) {
    const { instance: { members: [element] }, length } = s;
    return `[${length}]${element.structure.name}`;
  },
  getStructName(s) {
    for (const name of ['Allocator', 'Promise', 'Generator', 'Read', 'Writer']) {
      if (s.flags & StructFlag[`Is${name}`]) return name;
    }
    return `S${this.structureCounters.struct++}`;
  },
  getUnionName(s) {
    return `U${this.structureCounters.union++}`;
  },
  getErrorUnionName(s) {
    const { instance: { members: [payload, errorSet] } } = s;
    return `${errorSet.structure.name}!${payload.structure.name}`;
  },
  getErrorSetName(s) {
    return (s.flags & ErrorSetFlag.IsGlobal) ? 'anyerror' : `ES${this.structureCounters.errorSet++}`;
  },
  getEnumName(s) {
    return `EN${this.structureCounters.enum++}`;
  },
  getOptionalName(s) {
    const { instance: { members: [payload] } } = s;
    return `?${payload.structure.name}`;
  },
  getPointerName(s) {
    const { instance: { members: [target] }, flags } = s;
    let prefix = '*';
    let targetName = target.structure.name;
    if (target.structure.type === StructureType.Slice) {
      targetName = targetName.slice(3);
    }
    if (flags & PointerFlag.IsMultiple) {
      if (flags & PointerFlag.HasLength) {
        prefix = '[]';
      } else if (flags & PointerFlag.IsSingle) {
        prefix = '[*c]';
      } else {
        prefix = '[*]';
      }
    }
    if (!(flags & PointerFlag.IsSingle)) {
      // constructor can be null when a structure is recursive
      const sentinel = target.structure.constructor?.[SENTINEL];
      if (sentinel) {
        prefix = prefix.slice(0, -1) + `:${sentinel.value}` + prefix.slice(-1);
      }
    }
    if (flags & PointerFlag.IsConst) {
      prefix = `${prefix}const `;
    }
    return prefix + targetName;
  },
  getSliceName(s) {
    const { instance: { members: [element] }, flags } = s;
    return (flags & SliceFlag.IsOpaque) ? 'anyopaque' : `[_]${element.structure.name}`;
  },
  getVectorName(s) {
    const { instance: { members: [element] }, length } = s;
    return `@Vector(${length}, ${element.structure.name})`;
  },
  getOpaqueName(s) {
    return `O${this.structureCounters.opaque++}`;
  },
  getArgStructName(s) {
    const { instance: { members } } = s;
    const retval = members[0];
    const args = members.slice(1);
    const rvName = retval.structure.name;
    const argNames = args.map(a => a.structure.name);
    return `Arg(fn (${argNames.join(', ')}) ${rvName})`;
  },
  getVariadicStructName(s) {
    const { instance: { members } } = s;
    const retval = members[0];
    const args = members.slice(1);
    const rvName = retval.structure.name;
    const argNames = args.map(a => a.structure.name);
    return `Arg(fn (${argNames.join(', ')}, ...) ${rvName})`;
  },
  getFunctionName(s) {
    const { instance: { members: [args] } } = s;
    const argName = args.structure.name;
    return (argName) ? argName.slice(4, -1) : 'fn ()';
  },
  ...({
    exports: {
      createBool: { argType: 'b', returnType: 'v' },
      createInteger: { argType: 'ib', returnType: 'v' },
      createBigInteger: { argType: 'ib', returnType: 'v' },
      createString: { argType: 'ii', returnType: 'v' },
      createView: { argType: 'iib', returnType: 'v' },
      createInstance: { argType: 'vvv', returnType: 'v' },
      createTemplate: { argType: 'vv', returnType: 'v' },
      createList: { argType: '', returnType: 'v' },
      createObject: { argType: '', returnType: 'v' },
      getProperty: { argType: 'vii', returnType: 'v' },
      setProperty: { argType: 'viiv' },
      getSlotValue: { argType: 'vi', returnType: 'v' },
      setSlotValue: { argType: 'viv' },
      appendList: { argType: 'vv' },
      beginStructure: { argType: 'v' },
      finishStructure: { argType: 'v' },
    },
    imports: {
      getFactoryThunk: { argType: '', returnType: 'i' },
      getModuleAttributes: { argType: '', returnType: 'i' },
    },
    createBool(initializer) {
      return initializer;
    },
    createInteger(initializer, unsigned) {
      if (unsigned && initializer < 0) {
        return 0x1_0000_0000 + initializer;
      }
      return initializer
    },
    createBigInteger(initializer, unsigned) {
      if (unsigned && initializer < 0) {
        return 0x1_0000_0000_0000_0000n + initializer;
      }
      return initializer
    },
    createString(address, len) {
      const { buffer } = this.memory;
      const ta = new Uint8Array(buffer, address, len);
      return decodeText(ta);
    },
    createList() {
      return [];
    },
    createObject() {
      return {};
    },
    getProperty(object, address, len) {
      const key = this.createString(address, len);
      return object[key];
    },
    setProperty(object, address, len, value) {
      const key = this.createString(address, len);
      object[key] = value;
    },
  } ),
});

export { structureAcquisition as default };
