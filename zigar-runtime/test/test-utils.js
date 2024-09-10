export async function capture(cb) {
  const logFn = console.log;
  const lines = [];
  try {
    console.log = (text) => {
      if (typeof(text) === 'string') {
        for (const line of text.split(/\r?\n/)) {
          lines.push(line)
        }
      } else {
        logFn.call(console, text);
      }
    };
    await cb();
  } finally {
    console.log = logFn;
  }
  return lines;
}

export async function captureWarning(cb) {
  const warnFn = console.warn;
  const lines = [];
  try {
    console.warn = (text) => {
      if (typeof(text) === 'string') {
        for (const line of text.split(/\r?\n/)) {
          lines.push(line)
        }
      } else {
        warnFn.call(console, text);
      }
    };
    await cb();
  } finally {
    console.warn = warnFn;
  }
  return lines;
}

export async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export const addressSize = process.env.TARGET === 'wasm' ? 32 : 64;

export function usize(value) {
  return (addressSize === 64) ? BigInt(value) : Number(value);
}

export const getUsize = (addressSize === 64)
? DataView.prototype.getBigUint64
: DataView.prototype.getUint32;

export const setUsize = (addressSize === 64)
? DataView.prototype.setBigUint64
: DataView.prototype.setUint32;
