import { structureNames } from '../constants.js';
import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { MEMORY, SLOTS, TYPE, ALIGN, SIZE, ENVIRONMENT } from '../symbols.js';

const events = [ 'log', 'mkdir', 'stat', 'set_times', 'open', 'rmdir', 'unlink', 'syscall' ];

var baseline = mixin({
  init() {
    this.variables = [];
    this.listenerMap = new Map();
    this.envVariables = this.envVarArrays = null;
  },
  getSpecialExports() {
    const check = (v) => {
      if (v === undefined) throw new Error('Not a Zig type');
      return v;
    };
    return {
      init: () => this.initPromise,
      abandon: () => this.abandonModule?.(),
      redirect: (name, stream) => this.redirectStream(name, stream),
      sizeOf: (T) => check(T?.[SIZE]),
      alignOf: (T) => check(T?.[ALIGN]),
      typeOf: (T) => structureNamesLC[check(T?.[TYPE])],
      on: (name, cb) => this.addListener(name, cb),
      set: (name, value) => this.setObject(name, value),
    };
  },
  addListener(name, cb) {
    const index = events.indexOf(name);
    if (index >= 0) {
      if (!this.ioRedirection) {
        throw new Error(`Redirection disabled`);
      }
      this.listenerMap.set(name, cb);
    } else {
      throw new Error(`Unknown event: ${name}`);
    }
  },
  hasListener(name) {
    return this.listenerMap.get(name);
  },
  setObject(name, object) {
    if (typeof(object) !== 'object') {
      throw new TypeMismatch('object', object);
    }
    if (name === 'wasi' && "wasm" === 'wasm') {
      this.setCustomWASI(object);
    } else if (name === 'env') {
      this.envVariables = object;
      if (this.libc) {
        this.initializeLibc();
      }
    } else {
      throw new Error(`Unknown object: ${name}`);
    }
  },
  triggerEvent(name, event) {
    const listener = this.listenerMap.get(name);
    return listener?.(event);
  },
  recreateStructures(structures, settings) {
    Object.assign(this, settings);
    const insertObjects = (dest, placeholders) => {
      for (const [ slot, placeholder ] of Object.entries(placeholders)) {
        dest[slot] = createObject(placeholder);
      }
      return dest;
    };
    const readOnlyObjects = [];
    // empty arrays aren't replicated
    const getBuffer = a => (a.length) ? a.buffer : new ArrayBuffer(0);
    const createObject = (placeholder) => {
      const { memory, structure, actual, slots } = placeholder;
      if (memory) {
        if (actual) {
          return actual;
        } else {
          const { array, offset, length } = memory;
          const dv = this.obtainView(getBuffer(array), offset, length);
          const { handle } = placeholder;
          const { constructor } = structure;
          const object = constructor.call(ENVIRONMENT, dv);
          if (slots) {
            insertObjects(object[SLOTS], slots);
          }
          if (handle !== undefined) {
            // need to replace dataview with one pointing to Zig memory later,
            // when the VM is up and running
            this.variables.push({ handle, object });
          } else if (offset === undefined) {
            // save the object for later, since it constructor isn't isn't finalized yet
            // when offset is not undefined, the object is a child of another object and 
            // will be made read-only thru the parent (which might have a linkage handle)
            readOnlyObjects.push(object);
          }
          placeholder.actual = object;
          return object;
        }
      } else {
        return structure;
      }
    };
    const objectPlaceholders = new Map();
    for (const structure of structures) {
      // recreate the actual template using the provided placeholder
      for (const scope of [ structure.instance, structure.static ]) {
        if (scope.template) {
          const { slots, memory, handle } = scope.template;
          const object = scope.template = {};
          if (memory) {
            const { array, offset, length } = memory;
            object[MEMORY] = this.obtainView(getBuffer(array), offset, length);
            if (handle !== undefined) {
              this.variables.push({ handle, object });
            }
          }
          if (slots) {
            // defer creation of objects until shapes of structures are finalized
            const realSlots = object[SLOTS] = {};
            objectPlaceholders.set(realSlots, slots);
          }
        }
      }
      this.defineStructure(structure);
    }
    // insert objects into template slots
    for (const [ slots, placeholders ] of objectPlaceholders) {
      insertObjects(slots, placeholders);
    }
    // add static members, methods, etc.
    for (const structure of structures) {
      this.finalizeStructure(structure);
    }
    // after finalization, constructors of objects will have the properties needed 
    // for proper detection of what they are
    for (const object of readOnlyObjects) {
      this.makeReadOnly(object);
    }
  },
  ...({
    imports: {
      initializeLibc: { argType: 'ii' },
    },
  } ),
});

const structureNamesLC = structureNames.map(name => name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());

export { baseline as default };
