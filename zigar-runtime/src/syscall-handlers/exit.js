import { mixin } from '../environment.js';
import { Exit } from '../errors.js';

export default (process.env.TARGET === 'wasm') ? mixin({
  procExit(code) {
    throw new Exit(code);
  }
}) : undefined;
