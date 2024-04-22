require('node-zigar/cjs');
const { sha1 } = require('./lib/sha1.zigar');

const isMac = process.platform === 'darwin'

nw.Window.open('./src/index.html', { width: 800, height: 600 }, (browser) => {
  // create menu bar
  const onOpenClick = () => {
    const { window: { document } } = browser;
    document.getElementById('file').click();
  };
  const onCloseClick = () => {
    browser.close();
  };
  const menuBar = new nw.Menu({ type: 'menubar' });
  const fileMenu = new nw.Menu();
  fileMenu.append(new nw.MenuItem({ label: 'Open', click: onOpenClick }));
  fileMenu.append(new nw.MenuItem({ type: 'separator' }));
  fileMenu.append(new nw.MenuItem({ label: (isMac) ? 'Close' : 'Quit', click: onCloseClick }));
  menuBar.append(new nw.MenuItem({ label: 'File', submenu: fileMenu }));
  browser.menu = menuBar;

  browser.window.onload = (evt) => {
    // find page elements and attach handler
    const { target: document } = evt;
    const file = document.getElementById('file'); 
    const heading = document.getElementById('heading');
    file.onchange = async (evt) => {
      const { target: { files: [ file ] } } = evt;
      if (file) {
        const data = await file.arrayBuffer();
        const hash = sha1(data).string;
        heading.textContent = hash;
      }
    };
  };
});
