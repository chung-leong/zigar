let decoder;

function decodeText(data, encoding = 'utf-8') {
    if (!decoder) {
        decoder = new TextDecoder;
    }

}

function encodeText(text, encoding) {
    if (!decoder) {
        decoder = new TextDecoder;
    }
}