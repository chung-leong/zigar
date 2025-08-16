import { structureNames } from '../constants.js';
import { mixin } from '../environment.js';
import { MissingEventListener } from '../errors.js';
import { ALIGN, ENVIRONMENT, MEMORY, SIZE, SLOTS, TYPE } from '../symbols.js';

export default mixin({
  init() {
    this.variables = [];
    this.listenerMap = new Map([
      [ 'log', (e) => console.log(e.message) ],
    ]);
  },
  getSpecialExports() {
    const check = (v) => {
      if (v === undefined) throw new Error('Not a Zig type');
      return v;
    };
    return {
      init: (...args) => this.initialize?.(...args),
      abandon: () => this.abandonModule?.(),
      redirect: (fd, stream) => this.redirectStream(fd, stream),
      sizeOf: (T) => check(T?.[SIZE]),
      alignOf: (T) => check(T?.[ALIGN]),
      typeOf: (T) => structureNamesLC[check(T?.[TYPE])],
      on: (name, cb) => this.addListener(name, cb),
    };
  },
  addListener(name, cb) {
    this.listenerMap.set(name, cb);
    if (process.env.TARGET === 'node') {
      if ([ 'mkdir', 'stat', 'set_times', 'open', 'rmdir', 'unlink' ].includes(name)) {
        this.setRedirectionMask(name, !!cb);
      }
    }
  },
  hasListener(name) {
    return this.listenerMap.get(name);
  },
  triggerEvent(name, event, errorCode) {
    const listener = this.listenerMap.get(name);
    if (!listener) {
      if (errorCode) {
        throw new MissingEventListener(name, errorCode);
      } else {
        return;
      }
    }
    return listener(event);
  },
  recreateStructures(structures, settings) {
    Object.assign(this, settings);
    const insertObjects = (dest, placeholders) => {
      for (const [ slot, placeholder ] of Object.entries(placeholders)) {
        dest[slot] = createObject(placeholder);
      }
      return dest;
    };
    // empty arrays aren't replicated
    const getBuffer = a => (a.length) ? a.buffer : new ArrayBuffer(0);
    const createObject = (placeholder) => {
      const { memory, structure, actual } = placeholder;
      if (memory) {
        if (actual) {
          return actual;
        } else {
          const { array, offset, length } = memory;
          const dv = this.obtainView(getBuffer(array), offset, length);
          const { handle, const: isConst } = placeholder;
          const constructor = structure?.constructor;
          const object = placeholder.actual = constructor.call(ENVIRONMENT, dv);
          if (isConst) {
            this.makeReadOnly(object);
          }
          if (placeholder.slots) {
            insertObjects(object[SLOTS], placeholder.slots);
          }
          if (handle) {
            // need to replace dataview with one pointing to Zig memory later,
            // when the VM is up and running
            this.variables.push({ handle, object });
          }
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
            if (handle) {
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
  },
  /* c8 ignore start */
  ...(process.env.DEV ? {
    log(...args) {
      const c = this.console.source ?? globalThis.console;
      c?.log?.(...args);
    },
    showDiagnostics(title, lines) {
      this.log(
        `%c${title}\n%c${lines.join('\n')}`,
        'font-size: 140%; font-weight: bold; text-decoration: underline; line-height: 180%; text-decoration-thickness: 2px',
        'font-family: monospace; font-size: 110%'
      );
    },

    diagBaseline() {
      this.showDiagnostics('Baseline', [
        `Linked variable count: ${this.variables.length}`,
      ]);
    }
  } : undefined),
  /* c8 ignore end */
});

const structureNamesLC = structureNames.map(name => name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());
