import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
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

class MapDirectory {
  onClose = null;
  keys = null;
  cookie = 0n;

  constructor(map) {
    this.map = map;
    map.close = () => this.onClose?.();
  }

  readdir() {
    const offset = Number(this.cookie);
    let dent;
    switch (offset) {
      case 0:
      case 1: 
        dent = { name: '.'.repeat(offset + 1), type: 'directory' };
        break;
      default:
        if (!this.keys) {
          this.keys = [ ...this.map.keys() ];
        }
        const name = this.keys[offset - 2];
        if (name === undefined) {
          return null;
        }
        const stat = this.map.get(name);
        dent = { name, ...stat };        
    }
    this.cookie++;
    return dent;
  }

  seek(cookie) {
    return this.cookie = cookie;
  }

  tell() {
    return this.cookie;
  }

  valueOf() {
    return this.map;
  }
}

export { dirConversion as default };
