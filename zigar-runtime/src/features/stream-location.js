import { mixin } from '../environment.js';
import { decodeText } from '../utils.js';

export default mixin({
  init() {
    this.streamPathMap = new Map([ [ 3, '' ]]);
  },
  resolvePath(dirHandle, pathAddress, pathLen) {
    const pathArray = this.obtainZigArray(pathAddress, pathLen);
    let path = decodeText(pathArray).trim();
    if (path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    const parts = path.trim().split('/');
    const list = [];
    if (dirHandle && parts[0] !== '') {
      const parentPath = this.getStreamPath(dirHandle);
      if (parentPath !== undefined) {
        list.push(...parentPath.split('/'));
      }
    }
    for (const part of parts) {
      if (part === '..') {
        list.pop();
      } else if (part !== '.') {
        list.push(part);
      }
    }
    return list.join('/');
  },
  getStreamPath(fd) {
    return this.streamPathMap.get(fd);
  },
  setStreamPath(fd, path) {
    const m = this.streamPathMap;
    if (path) {
      m.set(fd, path)
    } else {
      m.delete(fd);
    }
  },
});
