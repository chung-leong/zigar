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
import pointerSynchronization from '../features/pointer-synchronization.js';
import thunkAllocation from '../features/thunk-allocation.js';
import { adjustAddress, decodeText, findObjects } from '../utils.js';
import wasiAdvise from '../wasi/advise.js';
import wasiAll from '../wasi/all.js';
import wasiAllocate from '../wasi/allocate.js';
import wasiClose from '../wasi/close.js';
import wasiDatasync from '../wasi/datasync.js';
import wasiEnv from '../wasi/env.js';
import wasiExit from '../wasi/exit.js';
import wasiFdstat from '../wasi/fdstat.js';
import wasiFilestat from '../wasi/filestat.js';
import wasiMkdir from '../wasi/mkdir.js';
import wasiOpen from '../wasi/open.js';
import wasiPrestat from '../wasi/prestat.js';
import wasiRandom from '../wasi/random.js';
import wasiRead from '../wasi/read.js';
import wasiReaddir from '../wasi/readdir.js';
import wasiRmdir from '../wasi/rmdir.js';
import wasiSeek from '../wasi/seek.js';
import wasiSetTime from '../wasi/set-times.js';
import wasiSync from '../wasi/sync.js';
import wasiTell from '../wasi/tell.js';
import wasiUnlink from '../wasi/unlink.js';
import wasiWrite from '../wasi/write.js';
import abortSignal from './abort-signal.js';
import baseline from './baseline.js';
import dataCopying from './data-copying.js';
import dirConversion from './dir-conversion.js';
import dir from './dir.js';
import envVariables from './env-variables.js';
import file from './file.js';
import generator from './generator.js';
import jsAllocator from './js-allocator.js';
import moduleLoading from './module-loading.js';
import objectLinkage from './object-linkage.js';
import promise from './promise.js';
import readerConversion from './reader-conversion.js';
import reader from './reader.js';
import streamLocation from './stream-location.js';
import streamPosition from './stream-position.js';
import streamRedirection from './stream-redirection.js';
import workerSupport from './worker-support.js';
import writerConversion from './writer-conversion.js';
import writer from './writer.js';

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
  readSlot(target, slot) {
    const slots = target ? target[SLOTS] : this.slots;
    return slots?.[slot];
  },
  writeSlot(target, slot, value) {
    const slots = target ? target[SLOTS] : this.slots;
    if (slots) {
      slots[slot] = value;
    }
  },
  createTemplate(dv) {
    return {
      [MEMORY]: dv,
      [SLOTS]: {}
    };
  },
  beginStructure(def) {
    const {
      type,
      purpose,
      name,
      length,
      signature = -1n,
      byteSize,
      align,
      flags,
    } = def;
    return {
      constructor: null,
      type,
      purpose,
      flags,
      signature,
      name,
      length,
      byteSize,
      align,
      instance: {
        members: [],
        template: null,
      },
      static: {
        members: [],
        template: null,
      },
    };
  },
  attachMember(structure, member, isStatic = false) {
    const target = (isStatic) ? structure.static : structure.instance;
    target.members.push(member);
  },
  attachTemplate(structure, template, isStatic = false) {
    const target = (isStatic) ? structure.static : structure.instance;
    target.template = template;
  },
  endStructure(structure) {
    if (!structure.name) {
      this.inferTypeName(structure);
    }
    this.structures.push(structure);
    this.finalizeStructure(structure);
  },
  captureView(address, len, copy, handle) {
    if (copy) {
      // copy content into JavaScript memory
      const dv = this.allocateJSMemory(len, 0);
      if (len > 0) {
        this.copyExternBytes(dv, address, len);
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
  castView(address, len, copy, structure, handle) {
    const { constructor, flags } = structure;
    const dv = this.captureView(address, len, copy, handle);
    const object = constructor.call(ENVIRONMENT, dv);
    if (flags & StructureFlag.HasPointer) {
      // acquire targets of pointers
      this.updatePointerTargets(null, object);
    }
    if (copy && len > 0) {
      this.makeReadOnly?.(object);
    }
    return object;
  },
  acquireStructures() {
    const attrs = this.getModuleAttributes();
    this.littleEndian = !!(attrs & ModuleAttribute.LittleEndian);
    this.runtimeSafety = !!(attrs & ModuleAttribute.RuntimeSafety);
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
        const jsDV = object[MEMORY] = this.captureView(address, len, true);
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
        this.use(wasiAll);
        switch (name) {
          case 'environ_get':
          case 'environ_sizes_get': this.use(wasiEnv); break;
          case 'fd_advise': this.use(wasiAdvise); break;
          case 'fd_allocate': this.use(wasiAllocate); break;
          case 'fd_close': this.use(wasiClose); break;
          case 'fd_datasync': this.use(wasiDatasync); break;
          case 'fd_fdstat_get': this.use(wasiFdstat); break;
          case 'fd_filestat_get':
          case 'path_filestat_get': this.use(wasiFilestat); break;
          case 'fd_filestat_set_times':
          case 'path_filestat_set_times': this.use(wasiSetTime); break;
          case 'fd_prestat_get':
          case 'fd_prestat_dir_name': this.use(wasiPrestat); break;
          case 'fd_sync': this.use(wasiSync); break;
          case 'fd_read': this.use(wasiRead); break;
          case 'fd_readdir': this.use(wasiReaddir); break;
          case 'fd_seek': this.use(wasiSeek); break;
          case 'fd_tell': this.use(wasiTell); break;
          case 'fd_write': this.use(wasiWrite); break;
          case 'path_create_directory': this.use(wasiMkdir); break;
          case 'path_remove_directory': this.use(wasiRmdir); break;
          case 'path_open': this.use(wasiOpen); break;
          case 'path_unlink': this.use(wasiUnlink); break;
          case 'proc_exit': this.use(wasiExit); break;
          case 'random_get': this.use(wasiRandom); break;
        }
        if (name.startsWith('path_') || name.includes('filestat')) {
          this.use(streamLocation);
        }
        switch (name) {
          case 'environ_get':
          case 'environ_sizes_get':
            this.use(envVariables);
            break;
          case 'path_open':
            this.use(readerConversion);
            this.use(writerConversion);
            break;
          case 'fd_close':
            this.use(streamRedirection);
            break;
          case 'fd_seek':
          case 'fd_tell':
            this.use(streamRedirection);
            this.use(streamPosition);
            break;
          case 'fd_write':
          case 'fd_read':
            this.use(streamRedirection);
            break;
        }
      }
      for (const structure of this.structures) {
        if (structure.type === StructureType.ArgStruct) {
          for (const { structure: { purpose } } of structure.instance.members) {
            switch (purpose) {
              case StructurePurpose.Allocator:
                this.use(jsAllocator);
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
                this.use(streamPosition);
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
    const { instance: { members: [member] }, static: { template }, flags } = s;
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
    return argName.slice(4, -1);
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
      captureView: null,
      castView: null,
      readSlot: null,
      writeSlot: null,
      beginStructure: null,
      attachMember: null,
      createTemplate: null,
      attachTemplate: null,
      defineStructure: null,
      endStructure: null,
    },
    imports: {
      getFactoryThunk: null,
      getModuleAttributes: null,
    },
    /* c8 ignore next */
  } : undefined),
});
