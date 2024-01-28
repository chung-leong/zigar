const { readFile } = require('fs/promises');
const { join } = require('path');

// use node-zigar
require('node-zigar/cjs');
const { sha1 } = require('./lib/sha1.zigar');

const isMac = process.platform === 'darwin'

// create browser window
const options = { width: 800, height: 600 };
nw.Window.open('index.html', options, function(win) {
  // create app menu
  const onOpenClick = () => {
    const { window: { document } } = win;
    const file = document.getElementById('file'); 
    file.onchange = async (evt) => {
      const { target: { files } } = evt;
      if (files.length > 0) {
        const [ file ] = files;
        const data = await readFile(file.path);
        const hash = sha1(data).string;
        const heading = document.getElementById('heading');
        heading.textContent = hash;
      }
    };
    file.click();
  };
  const onCloseClick = () => {
    win.close();
  };
  const menuBar = new nw.Menu({ type: 'menubar' });
  const fileMenu = new nw.Menu();
  fileMenu.append(new nw.MenuItem({ label: 'Open', click: onOpenClick }));
  fileMenu.append(new nw.MenuItem({ type: 'separator' }));
  fileMenu.append(new nw.MenuItem({ label: (isMac) ? 'Close' : 'Quit', click: onCloseClick }));
  menuBar.append(new nw.MenuItem({ label: 'File', submenu: fileMenu }));
  win.menu = menuBar;
});
