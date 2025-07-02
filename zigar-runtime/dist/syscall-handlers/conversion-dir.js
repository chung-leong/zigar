import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { hasMethod } from '../utils.js';

var conversionDir = mixin({
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

class MapDirectory {
  onClose = null;

  constructor(map) {
    this.map = map;
    map.close = () => this.onClose?.();
  }

  *readdir() {
    for (const [ name, stat ] of this.map) {
      yield { name, ...stat };
    }
  }

  valueOf() {
    return this.map;
  }
}

export { conversionDir as default };
