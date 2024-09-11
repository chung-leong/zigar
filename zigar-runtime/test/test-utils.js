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

export const addressSize = (process.env.BITS === '64')
? 64
: (process.env.BITS === '32')
? 32
: undefined;

export const addressByteSize = (process.env.BITS === '64')
? 8
: (process.env.BITS === '32')
? 4
: undefined;

export const usize = (process.env.BITS === '64')
? function(value) {
    return BigInt(value);
  }
: (process.env.BITS === '32')
? function(value) {
    return Number(value);
  }
: undefined;

export const getUsize = (process.env.BITS === '64')
? DataView.prototype.getBigUint64
: (process.env.BITS === '32')
? DataView.prototype.getUint32
: undefined;

export const setUsize = (process.env.BITS === '64')
? DataView.prototype.setBigUint64
: (process.env.BITS === '32')
? DataView.prototype.setUint32
: undefined;
