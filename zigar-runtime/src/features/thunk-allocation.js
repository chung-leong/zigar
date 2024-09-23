import { mixin } from '../environment.js';

export default mixin({
  ...(process.env.TARGET === 'wasm' ? {
    exports: {
      allocateJsThunk: { argType: 'ii', returnType: 'i' },
      freeJsThunk: { argType: 'ii', returnType: 'b' },
    },
    thunkSources: [],
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
      const empty = function() {};
      for (const { module, name, kind } of w.Module.imports(this.executable)) {
        if (kind === 'function') {
          if (module === 'env') {
            env[name] = empty;
          } else if (module === 'wasi_snapshot_preview1') {
            wasiPreview[name] = empty;
          } else if (module === 'wasi') {
            wasi[name] = empty;
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
      const { createJsThunk } = exports;
      const source = {
        thunkCount: 0,
        createJsThunk,
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
      if (!source) {
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
      return thunkAddress;
    },
    freeJsThunk(controllerAddress, thunkAddress) {
      // TODO
    },
  } : undefined),
});
