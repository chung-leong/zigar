let decoder;

export function decodeText(arrays, encoding = 'utf-8') {
  if (!decoder) {
    decoder = new TextDecoder;
  }
  let array;
  if (Array.isArray(arrays)) {
    if (arrays.length === 1) {
      array = arrays[0];
    } else {
      let len = 0;
      for (const a of arrays) {
        len += a.length;
      }
      array = new Uint8Array(len);
      let offset = 0;
      for (const a of arrays) {
        array.set(a, offset);
        offset += a.length;
      }
    }
  } else {
    array = arrays;
  }
  return decoder.decode(array);
}

export function encodeText(text, encoding) {
  if (!encoder) {
    encoder = new TextDecoder;
  }
  return encoder.encode(text);
}