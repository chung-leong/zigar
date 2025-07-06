import { Descriptor } from '../constants.js';
import { mixin } from '../environment.js';
import { decodeText } from '../utils.js';

var streamLocation = mixin({
  init() {
    this.streamLocationMap = new Map([ [ Descriptor.root, '' ]]);
  },
  obtainStreamLocation(dirfd, pathAddress, pathLen) {
    const pathArray = this.obtainZigArray(pathAddress, pathLen);
    let path = decodeText(pathArray).trim();
    if (path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    const parts = path.trim().split('/');
    const list = [];
    for (const part of parts) {
      if (part === '..') {
        list.pop();
      } else if (part !== '.' && part != '') {
        list.push(part);
      }
    }
    const stream = this.getStream(dirfd);
    return { parent: stream.valueOf(), path: list.join('/') };
  },
  getStreamLocation(fd) {
    return this.streamLocationMap.get(fd);
  },
  setStreamLocation(fd, path) {
    const m = this.streamLocationMap;
    if (path) {
      m.set(fd, path);
    } else {
      m.delete(fd);
    }
  },
  getDirectoryEntries(fd) {
    const dir = this.getStream(fd);
    return dir.readdir();
  },
});

export { streamLocation as default };
