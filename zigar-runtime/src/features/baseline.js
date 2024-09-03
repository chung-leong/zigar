mixin({
  getSpecialExports() {
    const check = (v) => {
      if (v === undefined) throw new Error('Not a Zig type');
      return v;
    };
    return {
      init: (...args) => this.initialize(...args),
      abandon: () => this.abandonModule?.(),
      released: () => this.released,
      connect: (console) => this.console = console,
      multithread: (enable) => this.setMultithread?.(enable),
      sizeOf: (T) => check(T[SIZE]),
      alignOf: (T) => check(T[ALIGN]),
      typeOf: (T) => this.getStructureName?.(check(T[TYPE])),
    };
  },

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
            // FIXME
            // object[PROTECTOR]?.();
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
    this.resetGlobalErrorSet?.();
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

  ...(process.env.TARGET === 'wasm' ? {
    littleEndian: true,

    async initialize(wasi) {
      this.setCustomWASI?.(wasi);
      await this.initPromise;
    },
  } : process.env.TARGET === 'node' ? {
    littleEndian: true,
  } : undefined),
});

function isNeeded() {
  return true;
}
