import { mixin } from '../environment.js';
import { Exit } from '../errors.js';

var wasiExit = mixin({
  wasi_proc_exit(code) {
    throw new Exit(code);
  }
}) ;

export { wasiExit as default };
