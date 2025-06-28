import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';

export default mixin({
  convertDirectory(arg) {
    if (arg instanceof Map) {
      return new MapDirectory(arg);
    } else {
      throw new TypeMismatch('map or object with directory interface', arg);
    }
  }
});

class MapDirectory {
  constructor(map) {
    this.map = map;
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
