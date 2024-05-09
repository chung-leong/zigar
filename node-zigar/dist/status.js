import { write } from 'fs';
import { isatty } from 'tty';

const statusCharacters = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
let statusClear;

export function showStatus(message) {
  const fd = 2;
  const tty = isatty(fd);
  hideStatus();
  if (tty) {
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
    };
    update(); 
  } else {
    write(fd, message, () => {});
    statusClear = () => {
      write(fd, `\b \b`.repeat(message.length), () => {});
    };
  }  
}

export function hideStatus() {
  statusClear?.();
  statusClear = null;
}

export function showResult(message) {
  const fd = 2;
  const tty = isatty(fd);
  const c = '✓';
  write(fd, `\r\x1b[32m${c}\x1b[0m ${message}\n`, () => {});
}
