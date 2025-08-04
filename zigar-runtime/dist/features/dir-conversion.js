import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { MapDirectory } from '../streams.js';
import { hasMethod } from '../utils.js';

var dirConversion = mixin({
  convertDirectory(arg) {
    if (arg instanceof Map) {
      return new MapDirectory(arg);
    } else if (hasMethod(arg, 'readdir')) {
      return arg;
    } else {
      throw new TypeMismatch('map or object with directory interface', arg);
    }
  }
});

export { dirConversion as default };
