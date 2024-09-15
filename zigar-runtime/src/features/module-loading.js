import { mixin } from '../environment.js';

export default mixin({
  exports: {},
  imports: {},
  released: false,
  abandoned: false,

  releaseFunctions() {
    const throwError = () => { throw new Error(`Module was abandoned`) };
    for (const name of Object.keys(this.imports)) {
      if (this[name]) {
        this[name] = throwError;
      }
    }
  },
  isReleased() {
    return this.released;
  },
  abandonModule() {
    if (!this.abandoned) {
      this.setMultithread?.(false);
      this.releaseFunctions();
      this.unlinkVariables?.();
      this.abandoned = true;
    }
  },
  ...(process.env.TARGET === 'wasm' ? {
    nextValueIndex: 1,
    valueMap: new Map(),
    valueIndices: new Map(),

    async initialize(wasi) {
      this.setCustomWASI?.(wasi);
      await this.initPromise;
    },
    clearExchangeTable() {
      if (this.nextValueIndex !== 1) {
        this.nextValueIndex = 1;
        this.valueMap = new Map();
        this.valueIndices = new Map();
      }
    },
    getObjectIndex(object) {
      if (object != null) {
        let index = this.valueIndices.get(object);
        if (index === undefined) {
          index = this.nextValueIndex++;
          this.valueIndices.set(object, index);
          this.valueMap.set(index, object);
        }
        return index;
      } else {
        return 0;
      }
    },
    fromWebAssembly(type, arg) {
      switch (type) {
        case 'v':
        case 's': return this.valueMap.get(arg);
        case 'i': return arg;
        case 'b': return !!arg;
      }
    },
    toWebAssembly(type, arg) {
      switch (type) {
        case 'v':
        case 's': return this.getObjectIndex(arg);
        case 'i': return arg;
        case 'b': return arg ? 1 : 0;
      }
    },
    exportFunction(fn, argType = '', returnType = '') {
      if (!fn) {
        return () => {};
      }
      return (...args) => {
        args = args.map((arg, i) => this.fromWebAssembly(argType.charAt(i), arg));
        const retval = fn.apply(this, args);
        return this.toWebAssembly(returnType, retval);
      };
    },
    importFunction(fn, argType = '', returnType = '') {
      return (...args) => {
        args = args.map((arg, i) => this.toWebAssembly(argType.charAt(i), arg));
        const retval = fn.apply(this, args);
        return this.fromWebAssembly(returnType, retval);
      };
    },
    exportFunctions() {
      const imports = {};
      for (const [ name, { argType, returnType, alias } ] of Object.entries(this.exports)) {
        const fn = this[alias ?? name];
        if (process.env.DEV) {
          if (!fn) {
            throw new Error(`Unable to export function: ${name}`);
          }
        }
        imports[`_${name}`] = this.exportFunction(fn, argType, returnType);
      }
      return imports;
    },
    importFunctions(exports) {
      for (const [ name, { argType, returnType } ] of Object.entries(this.imports)) {
        const fn = exports[name];
        if (process.env.DEV) {
          if (!fn) {
            throw new Error(`Unable to import function: ${name}`);
          }
        }
        this[name] = this.importFunction(fn, argType, returnType);
      }
    },
    async instantiateWebAssembly(source, options) {
      const {
        memoryInitial,
        memoryMax,
        tableInitial,
        multithreaded,
      } = options;
      const res = await source;
      this.hasCodeSource = true;
      const wasi = this.getWASIImport();
      const env = this.exportFunctions();
      this.memory = env.memory = new WebAssembly.Memory({
        initial: memoryInitial,
        maximum: memoryMax,
        shared: multithreaded,
      });
      this.table = env.__indirect_function_table = new WebAssembly.Table({
        initial: tableInitial,
        element: 'anyfunc',
      });
      this.multithreaded = multithreaded;
      this.nextTableIndex = tableInitial;
      const imports = { env, wasi_snapshot_preview1: wasi };
      if (res[Symbol.toStringTag] === 'Response') {
        return WebAssembly.instantiateStreaming(res, imports);
      } else {
        return WebAssembly.instantiate(res, imports);
      }
    },
    loadModule(source, options) {
      return this.initPromise = (async () => {
        const { instance } = await this.instantiateWebAssembly(source, options);
        const { exports } = instance;
        this.importFunctions(exports);
        this.trackInstance(instance);
        this.customWASI?.initialize?.(instance);
        this.runtimeSafety = this.isRuntimeSafetyActive();
      })();
    },
    trackInstance(instance) {
      // use WeakRef to detect whether web-assembly instance has been gc'ed
      const ref = new WeakRef(instance);
      Object.defineProperty(this, 'released', { get: () => !ref.deref(), enumerable: true });
    },
  } : process.env.TARGET === 'node' ? {
    imports: {
      loadModule: null,
    },

    exportFunctions() {
      const imports = {};
      for (const [ name, alias ] of Object.entries(this.exports)) {
        const fn = this[alias ?? name];
        if (process.env.DEV) {
          if (!fn) {
            throw new Error(`Unable to export function: ${name}`);
          }
        }
        imports[name] = fn.bind(this);
      }
      return imports;
    },
    importFunctions(exports) {
      for (const [ name, alias ] of Object.entries(this.imports)) {
        const fn = exports[alias ?? name];
        if (process.env.DEV) {
          if (!fn) {
            throw new Error(`Unable to import function: ${name}`);
          }
        }
        this[name] = fn;
      }
    },
  } : undefined)
});