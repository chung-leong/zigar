import { mixin } from '../environment.js';
import { Exit } from '../errors.js';

export default mixin({
  wasi_proc_exit(code) {
    throw new Exit(code);
  }
});
