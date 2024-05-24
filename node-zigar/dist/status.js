import { write } from 'fs';
import { isatty } from 'tty';
import { platform } from 'os';
import { execSync } from 'child_process';

const statusCharacters = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
let statusClear;

export function showStatus(message) {
  const fd = 2;
  const tty = isatty(fd);
  let currentCP;
  hideStatus();
  if (tty) {
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
      if (currentCP && currentCP !== 65001) {
        try {
          execSync(`chcp ${currentCP}`);
        } catch (err){
        }
      }
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
