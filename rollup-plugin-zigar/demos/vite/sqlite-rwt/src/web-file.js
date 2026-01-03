export class WebFile {
  static async create(url, prefetch = 16384) {
    let resp = await fetch(url, {
      headers: {
        Range: `bytes=0-16383`,
      },
    });
    let size;
    if (resp.status === 206) {
      const encoding = resp.headers.get("content-encoding");
      if (encoding) {
        resp = await fetch(url);
      } else {
        const range = resp.headers.get("content-range");
        size = parseInt(range.slice(range.indexOf('/') + 1));   // e.g. "bytes 0-16384/1261568"
      }
    }
    const buffer = await resp.arrayBuffer();
    if (size === undefined) {
      size = buffer.byteLength;
    }
    const self = new WebFile();
    self.url = url;
    self.size = size;
    self.pos = 0;
    self.cache = new Uint8Array(buffer);
    return self;
  }
  
  async pread(len, offset) {
    const end = offset + len;
    if (end <= this.cache.length) {
      return this.cache.slice(offset, end);
    }
    const resp = await fetch(this.url, {
      headers: {
        Range: `bytes=${offset}-${end - 1}`,
      },
    });
    if (!resp.headers.get('content-range')) {
      throw new Error('Missing range header');
    }
    const buffer = await resp.arrayBuffer();
    return new Uint8Array(buffer);
  }

  async read(len) {
    const chunk = await this.pread(len, this.pos);
    this.pos += chunk.length;
    return chunk;
  }

  tell() {
    return this.pos;
  }

  seek(offset, whence) {
    let pos = -1;
    switch (whence) {
      case 0: pos = offset; break;
      case 1: pos = this.pos + offset; break;
      case 2: pos = this.size + offset; break;
    }
    if (!(pos >= 0 && pos <= this.size)) throw new Error('Invalid argument');
    this.pos = pos;
    return pos;
  }
}
