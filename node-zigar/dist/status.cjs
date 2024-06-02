const { write } = require('fs');
const { isatty } = require('tty');
const { platform } = require('os');
const { execSync } = require('child_process');

const statusCharacters = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
let statusClear;

function showStatus(message) {
  const fd = 2;
  const tty = isatty(fd);
  let currentCP;
  hideStatus();
  if (tty) {
    /* c8 ignore start */
    if (platform() === 'win32') {
      try {
        const m = /\d+/.exec(execSync('chcp').toString().trim());
        if (m) {
          currentCP = parseInt(m[0]);
          if (currentCP !== 65001) {
            execSync('chcp 65001');
          }
        }
      } catch (err) {
      }
    }
    /* c8 ignore end */
    let pos = 0;
    const update = () => {
      const c = statusCharacters.charAt(pos++);
      if (pos >= statusCharacters.length) {
        pos = 0;
      }
      write(fd, `\r\x1b[33m${c}\x1b[0m ${message}`, () => {});
    };
    const interval = setInterval(update, 150);
    statusClear = () => {
      clearInterval(interval);
      write(fd, '\r\x1b[K', () => {});
      /* c8 ignore start */
      if (currentCP && currentCP !== 65001) {
        try {
          execSync(`chcp ${currentCP}`);
        } catch (err){
        }
      }
      /* c8 ignore end */
    };
    update();
    /* c8 ignore next 6 */
  } else {
    write(fd, message, () => {});
    statusClear = () => {
      write(fd, `\b \b`.repeat(message.length), () => {});
    };
  }
}

function hideStatus() {
  statusClear?.();
  statusClear = null;
}

function showResult(message) {
  const fd = 2;
  const tty = isatty(fd);
  const c = '✓';
  if (tty) {
    write(fd, `\r\x1b[32m${c}\x1b[0m ${message}\n`, () => {});
    /* c8 ignore next 3 */
  } else {
    write(fd, `${message}\n`, () => {});
  }
}

module.exports = {
  showStatus,
  hideStatus,
  showResult,
};