import { mixin } from '../environment.js';
import { Exit } from '../errors.js';

export default (process.env.TARGET === 'wasm') ? mixin({
  wasi_proc_exit(code) {
    throw new Exit(code);
  }
}) : undefined;
