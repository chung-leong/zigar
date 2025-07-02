import { mixin } from '../environment.js';
import { Exit } from '../errors.js';

var exit = mixin({
  procExit(code) {
    throw new Exit(code);
  }
}) ;

export { exit as default };
