import { mixin } from '../environment.js';
import { MapDirectory } from '../streams.js';
import { hasMethod } from '../utils.js';

export default mixin({
  convertDirectory(arg) {
    if (arg instanceof Map) {
      return new MapDirectory(arg);
    } else if (hasMethod(arg, 'readdir')) {
      return arg;
    }
  }
});

