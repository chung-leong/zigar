import {
  ENVIRONMENT, MEMORY, SENTINEL, SLOTS, ZIG
} from '../../src/symbols.js';
import accessorAll from '../accessors/all.js';
import accessorInt from '../accessors/int.js';
import {
  ErrorSetFlag, MemberType, ModuleAttribute, PointerFlag, PrimitiveFlag, SliceFlag, StructFlag, StructureFlag,
  structureNames, StructurePurpose, StructureType,
} from '../constants.js';
import { mixin } from '../environment.js';
import callMarshalingInbound from '../features/call-marshaling-inbound.js';
import callMarshalingOutbound from '../features/call-marshaling-outbound.js';
import dirConversion from '../features/dir-conversion.js';
import moduleLoading from '../features/module-loading.js';
import pointerSynchronization from '../features/pointer-synchronization.js';
import readerConversion from '../features/reader-conversion.js';
import thunkAllocation from '../features/thunk-allocation.js';
import writerConversion from '../features/writer-conversion.js';
import abortSignal from '../structures/abort-signal.js';
import allocator from '../structures/allocator.js';
import dir from '../structures/dir.js';
import file from '../structures/file.js';
import generator from '../structures/generator.js';
import promise from '../structures/promise.js';
import reader from '../structures/reader.js';
import writer from '../structures/writer.js';
import environGet from '../syscalls/environ-get.js';
import environSizesGet from '../syscalls/environ-sizes-get.js';
import fdAdvise from '../syscalls/fd-advise.js';
import fdAllocate from '../syscalls/fd-allocate.js';
import fdClose from '../syscalls/fd-close.js';
import fdDatasync from '../syscalls/fd-datasync.js';
import fdFdstatGet from '../syscalls/fd-fdstat-get.js';
import fdFdstatSetFlags from '../syscalls/fd-fdstat-set-flags.js';
import fdFdstatSetRights from '../syscalls/fd-fdstat-set-rights.js';
import fdFilestatGet from '../syscalls/fd-filestat-get.js';
import fdFileStatSetTimes from '../syscalls/fd-filestat-set-times.js';
import fdPread from '../syscalls/fd-pread.js';
import fdPrestatDirName from '../syscalls/fd-prestat-dir-name.js';
import fdPrestatGet from '../syscalls/fd-prestat-get.js';
import fdPwrite from '../syscalls/fd-pwrite.js';
import fdRead from '../syscalls/fd-read.js';
import fdReaddir from '../syscalls/fd-readdir.js';
import fdSeek from '../syscalls/fd-seek.js';
import fdSync from '../syscalls/fd-sync.js';
import fdTell from '../syscalls/fd-tell.js';
import fdWrite from '../syscalls/fd-write.js';
import pathCreateDirectory from '../syscalls/path-create-directory.js';
import pathFilestatGet from '../syscalls/path-filestat-get.js';
import pathFilestatSetTimes from '../syscalls/path-filestat-set-times.js';
import pathOpen from '../syscalls/path-open.js';
import pathRemoveDirectory from '../syscalls/path-remove-directory.js';
import pathUnlinkFile from '../syscalls/path-unlink-file.js';
import procExit from '../syscalls/proc-exit.js';
import randomGet from '../syscalls/random-get.js';
import { adjustAddress, decodeText, findObjects } from '../utils.js';
import baseline from './baseline.js';
import dataCopying from './data-copying.js';
import objectLinkage from './object-linkage.js';
import streamLocation from './stream-location.js';
import streamRedirection from './stream-redirection.js';
import wasiSupport from './wasi-support.js';
import workerSupport from './worker-support.js';

export default mixin({
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
      if (process.env.TARGET === 'wasm') {
        dv[ZIG].handle = address;
      } else {
        dv[ZIG].handle = handle;
      }
      return dv;
    }
  },
  createInstance(structure, dv, slots) {
    const { constructor, flags } = structure;
    const object = constructor.call(ENVIRONMENT, dv);
    if (flags & StructureFlag.HasPointer) {
      // acquire targets of pointers
      this.updatePointerTargets(null, object);
    }
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
    this.ioDirection = !!(attrs & ModuleAttribute.ioRedirection);
    this.libc = !!(attrs & ModuleAttribute.LibC);
    const thunkAddress = this.getFactoryThunk();
    const thunk = { [MEMORY]: this.obtainZigView(thunkAddress, 0) };
    this.comptime = true;
    this.mixinUsage = new Map();
    this.invokeThunk(thunk, thunk, thunk);
    this.comptime = false;
    // acquire default pointers now that we have all constructors
    for (const structure of this.structures) {
      const { constructor, flags, instance: { template } } = structure;
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
    const { structures, runtimeSafety, littleEndian, libc } = this;
    return {
      structures,
      settings: { runtimeSafety, littleEndian, libc },
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
    /* c8 ignore start */
    if (process.env.MIXIN === 'track') {
      this.use(baseline);
      if (list.length > 0) {
        // mixin "features/object-linkage" is used when there are objects linked to Zig memory
        this.use(objectLinkage);
      }
      if (this.hasMethods()) {
        this.use(moduleLoading);
        this.use(callMarshalingOutbound);
        this.use(pointerSynchronization);
      }
      if (this.using(dataCopying)) {
        this.use(accessorAll);
        this.use(accessorInt);
      }
      for (const name of Object.keys(this.exportedModules.wasi)) {
        switch (name) {
          case 'thread-spawn': this.use(workerSupport); break;
        }
      }
      for (const name of Object.keys(this.exportedModules.wasi_snapshot_preview1)) {
        this.use(wasiSupport);
        switch (name) {
          case 'environ_get': this.use(environGet); break;
          case 'environ_sizes_get': this.use(environSizesGet); break;
          case 'fd_advise': this.use(fdAdvise); break;
          case 'fd_allocate': this.use(fdAllocate); break;
          case 'fd_close': this.use(fdClose); break;
          case 'fd_datasync': this.use(fdDatasync); break;
          case 'fd_fdstat_get': this.use(fdFdstatGet); break;
          case 'fd_fdstat_set_flags': this.use(fdFdstatSetFlags); break;
          case 'fd_fdstat_set_rights': this.use(fdFdstatSetRights); break;
          case 'fd_filestat_get':this.use(fdFilestatGet); break;
          case 'fd_filestat_set_times': this.use(fdFileStatSetTimes); break;
          case 'fd_pread': this.use(fdPread); break;
          case 'fd_prestat_get': this.use(fdPrestatGet); break;
          case 'fd_prestat_dir_name': this.use(fdPrestatDirName); break;
          case 'fd_pwrite': this.use(fdPwrite); break;
          case 'fd_read': this.use(fdRead); break;
          case 'fd_readdir': this.use(fdReaddir); break;
          case 'fd_seek': this.use(fdSeek); break;
          case 'fd_sync': this.use(fdSync); break;
          case 'fd_tell': this.use(fdTell); break;
          case 'fd_write': this.use(fdWrite); break;
          case 'path_create_directory': this.use(pathCreateDirectory); break;
          case 'path_filestat_get': this.use(pathFilestatGet); break;
          case 'path_remove_directory': this.use(pathRemoveDirectory); break;
          case 'path_filestat_set_times': this.use(pathFilestatSetTimes); break;
          case 'path_open': 
            this.use(pathOpen); 
            this.use(readerConversion);
            this.use(writerConversion);
            break;
          case 'path_unlink': this.use(pathUnlinkFile); break;
          case 'proc_exit': this.use(procExit); break;
          case 'random_get': this.use(randomGet); break;
        }
        if (name.startsWith('path_')) {
          this.use(streamLocation);
        }
        if (name.startsWith('fd_')) {
          this.use(streamRedirection);
        }
      }
      for (const structure of this.structures) {
        if (structure.type === StructureType.ArgStruct) {
          for (const { structure: { purpose } } of structure.instance.members) {
            switch (purpose) {
              case StructurePurpose.Allocator:
                this.use(allocator);
                break;
              case StructurePurpose.Promise:
                this.use(promise);
                break;
              case StructurePurpose.Generator:
                this.use(generator);
                break;
              case StructurePurpose.AbortSignal:
                this.use(abortSignal);
                break;
              case StructurePurpose.Reader:
                this.use(reader);
                this.use(readerConversion);
                break;
              case StructurePurpose.Writer:
                this.use(writer);
                this.use(writerConversion);
                break;
              case StructurePurpose.File:
                this.use(file);
                this.use(streamRedirection);
                this.use(readerConversion);
                this.use(writerConversion);
                break;
              case StructurePurpose.Directory:
                this.use(dir);
                this.use(dirConversion);
                this.use(streamRedirection);
                this.use(streamLocation);
                break;
            }
          }
        } else if (structure.type === StructureType.Function) {
          const { static: { template: jsThunkController } } = structure;
          if (jsThunkController) {
            this.use(callMarshalingInbound);
            this.use(pointerSynchronization);
            if (!this.use(workerSupport)) {
              this.use(thunkAllocation);
            }
          }
        }
      }
    }
    /* c8 ignore end */
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
    let prefix = '*'
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
  ...(process.env.TARGET === 'wasm' ? {
    exports: {
      captureString: { argType: 'ii', returnType: 'v' },
      captureView: { argType: 'iib', returnType: 'v' },
      castView: { argType: 'iibv', returnType: 'v' },
      readSlot: { argType: 'vi', returnType: 'v' },
      writeSlot: { argType: 'viv' },
      beginDefinition: { returnType: 'v' },
      insertInteger: { argType: 'vsib' },
      insertBigInteger: { argType: 'vsib' },
      insertBoolean: { argType: 'vsb', alias: 'insertProperty' },
      insertString: { argType: 'vss', alias: 'insertProperty' },
      insertObject: { argType: 'vsv', alias: 'insertProperty' },
      beginStructure: { argType: 'v', returnType: 'v' },
      attachMember: { argType: 'vvb' },
      createTemplate: { argType: 'v', returnType: 'v' },
      attachTemplate: { argType: 'vvb' },
      defineStructure: { argType: 'v', returnType: 'v' },
      endStructure: { argType: 'v' },
    },
    imports: {
      getFactoryThunk: { argType: '', returnType: 'i' },
      getModuleAttributes: { argType: '', returnType: 'i' },
    },
    beginDefinition() {
      return {};
    },
    insertProperty(def, name, value) {
      def[name] = value;
    },
    insertInteger(def, name, value, unsigned) {
      if (unsigned && value < 0) {
        value = 0x1_0000_0000 + value;
      }
      def[name] = value;
    },
    insertBigInteger(def, name, value, unsigned) {
      if (unsigned && value < 0n) {
        value = 0x1_0000_0000_0000_0000n + value;
      }
      def[name] = value;
    },
    captureString(address, len) {
      const { buffer } = this.memory;
      const ta = new Uint8Array(buffer, address, len);
      return decodeText(ta);
    },
  } : process.env.TARGET === 'node' ? {
    exports: {
      createView: {},
      createInstance: {},
      createTemplate: {},
      appendList: {},
      getSlotValue: {},
      setSlotValue: {},
      beginStructure: {},
      finishStructure: {},
    },
    imports: {
      getFactoryThunk: {},
      getModuleAttributes: {},
    },
    /* c8 ignore next */
  } : undefined),
});
