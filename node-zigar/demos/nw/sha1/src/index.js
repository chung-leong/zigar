const { readFile } = require('fs/promises');
const { join } = require('path');
require('node-zigar/cjs');
const { sha1 } = require('./lib/sha1.zigar');

const isMac = process.platform === 'darwin'

nw.Window.open('./src/index.html', { width: 800, height: 600 }, (browser) => {
  // handle menu click
  const onOpenClick = () => {
    const { window: { document } } = browser;
    const file = document.getElementById('file'); 
    const heading = document.getElementById('heading');
    file.onchange = async (evt) => {
      const { target: { files } } = evt;
      if (files.length > 0) {
        const [ file ] = files;
        const data = await readFile(file.path);
        const hash = sha1(data).string;
        heading.textContent = hash;
      }
    };
    file.click();
  };
  const onCloseClick = () => {
    browser.close();
  };
  // create menu bar
  const menuBar = new nw.Menu({ type: 'menubar' });
  const fileMenu = new nw.Menu();
  fileMenu.append(new nw.MenuItem({ label: 'Open', click: onOpenClick }));
  fileMenu.append(new nw.MenuItem({ type: 'separator' }));
  fileMenu.append(new nw.MenuItem({ label: (isMac) ? 'Close' : 'Quit', click: onCloseClick }));
  menuBar.append(new nw.MenuItem({ label: 'File', submenu: fileMenu }));
  browser.menu = menuBar;    
});
