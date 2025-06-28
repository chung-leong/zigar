import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';

export default mixin({
  convertDirectory(arg) {
    if (arg instanceof Map) {
      return new MapDirectory(arg);
    } else if (arg?.[Symbol.toStringTag] === 'Generator') {
      return new GeneratorDirectory(arg);
    } else {
      throw new TypeMismatch('map, generator, or object with directory interface', arg);
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
}

class GeneratorDirectory {
  constructor(generator) {
    this.generator = generator;
  }

  readdir() {
    return this.generator;
  }
}
