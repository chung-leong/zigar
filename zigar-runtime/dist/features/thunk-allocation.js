import { mixin } from '../environment.js';
import { empty } from '../utils.js';

var thunkAllocation = mixin({
  ...({
    exports: {
      allocateJsThunk: { argType: 'ii', returnType: 'i' },
      freeJsThunk: { argType: 'ii', returnType: 'i' },
    },
    init() {
      this.thunkSources = [];
      this.thunkMap = new Map();
    },
    addJsThunkSource() {
      const {
        memoryInitial,
        memoryMax,
        tableInitial,
        multithreaded,
      } = this.options;
      const w = WebAssembly;
      const env = {}, wasi = {}, wasiPreview = {};
      const imports = { env, wasi, wasi_snapshot_preview1: wasiPreview };
      for (const { module, name, kind } of w.Module.imports(this.executable)) {
        if (kind === 'function') {
          if (module === 'env') {
            env[name] = empty;
          } else if (module === 'wasi_snapshot_preview1') {
            wasiPreview[name] = empty;
          }
        }
      }
      env.memory = new w.Memory({
        initial: memoryInitial,
        maximum: memoryMax,
        shared: multithreaded,
      });
      const table = env.__indirect_function_table = new w.Table({
        initial: tableInitial,
        element: 'anyfunc',
      });
      const { exports } = new w.Instance(this.executable, imports);
      const { createJsThunk, destroyJsThunk } = exports;
      const source = {
        thunkCount: 0,
        createJsThunk,
        destroyJsThunk,
        table,
      };
      this.thunkSources.unshift(source);
      return source;
    },
    allocateJsThunk(controllerAddress, funcId) {
      let source, sourceAddress = 0;
      for (source of this.thunkSources) {
        sourceAddress = source.createJsThunk(controllerAddress, funcId);
        break;
      }
      if (!sourceAddress) {
        source = this.addJsThunkSource();
        sourceAddress = source.createJsThunk(controllerAddress, funcId);
      }
      // sourceAddress is an index into the function table of the source instance
      // we need to get the function object and place it into the main instance's
      // function table
      const thunkObject = source.table.get(sourceAddress);
      let thunkAddress = 0;
      for (let i = this.table.length - 1; i >= this.initialTableLength; i--) {
        if (!this.table.get(i)) {
          thunkAddress = i;
          break;
        }
      }
      if (!thunkAddress) {
        thunkAddress = this.table.length;
        this.table.grow(8);
      }
      this.table.set(thunkAddress, thunkObject);
      source.thunkCount++;
      // remember where the object is from
      this.thunkMap.set(thunkObject, { source, sourceAddress });
      return thunkAddress;
    },
    freeJsThunk(controllerAddress, thunkAddress) {
      let fnId = 0;
      const thunkObject = this.table.get(thunkAddress);
      this.table.set(thunkAddress, null);
      const entry = this.thunkMap.get(thunkObject);
      if (entry) {
        const { source, sourceAddress } = entry;
        fnId = source.destroyJsThunk(controllerAddress, sourceAddress);
        if (--source.thunkCount === 0) {
          const index = this.thunkSources.indexOf(source);
          if (index !== -1) {
            this.thunkSources.splice(index, 1);
          }
        }
        this.thunkMap.delete(thunkObject);
      }
      return fnId;
    },
  } ),
});

export { thunkAllocation as default };
