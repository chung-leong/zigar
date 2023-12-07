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
  