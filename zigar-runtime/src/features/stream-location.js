import { PosixDescriptor } from '../constants.js';
import { mixin } from '../environment.js';
import { InvalidPath } from '../errors.js';
import { decodeText } from '../utils.js';

export default mixin({
  init() {
    this.streamLocationMap = new Map([ [ PosixDescriptor.root, '' ]]);
  },
  obtainStreamLocation(dirFd, pathAddress, pathLen) {
    const pathArray = this.obtainZigArray(pathAddress, pathLen);
    let path = decodeText(pathArray).trim();
    if (path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    const parts = path.trim().split('/');
    const list = [];
    for (const part of parts) {
      if (part === '..') {
        if (list.length > 0) {
          list.pop();
        } else {
          throw new InvalidPath(path);
        }
      } else if (part !== '.' && part != '') {
        list.push(part);
      }
    }
    if (!parts[0]) {
      // absolute path
      dirFd = PosixDescriptor.root;
    }
    const [ stream ] = this.getStream(dirFd);
    return { parent: stream.valueOf(), path: list.join('/') };
  },
  getStreamLocation(fd) {
    return this.streamLocationMap.get(fd);
  },
  setStreamLocation(fd, loc) {
    const m = this.streamLocationMap;
    if (loc) {
      m.set(fd, loc)
    } else {
      m.delete(fd);
    }
  },
});
