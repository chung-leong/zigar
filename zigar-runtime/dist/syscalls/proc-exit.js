import { mixin } from '../environment.js';
import { Exit } from '../errors.js';

var procExit = mixin({
  procExit(code) {
    throw new Exit(code);
  }
}) ;

export { procExit as default };
