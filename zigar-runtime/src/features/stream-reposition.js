import { mixin } from '../environment.js';
import { IllegalSeek } from '../errors.js';

export default mixin({
  changeStreamPointer(fd, offset, whence) {
    const reader = this.getStream(fd);
    if (typeof(reader.seek) !== 'function') {
      throw new IllegalSeek();
    }
    return reader.seek(offset, whence);
  },
  getStreamPointer(fd) {
    const reader = this.getStream(fd);
    if (typeof(reader.tell) !== 'function') {
      throw new IllegalSeek();
    }
    return reader.tell();
  },
});
