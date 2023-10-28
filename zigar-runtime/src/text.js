let decoder;

export function decodeText(data, encoding = 'utf-8') {
  if (!decoder) {
    decoder = new TextDecoder;
  }
  return decoder.decode(data);
}

export function encodeText(text, encoding) {
  if (!encoder) {
    encoder = new TextDecoder;
  }
  return encoder.encode(text);
}