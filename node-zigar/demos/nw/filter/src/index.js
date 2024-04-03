const isMac = process.platform === 'darwin'

nw.Window.open('./src/index.html', { width: 800, height: 600 }, (browser) => {
  // handle menu click
  const onOpenClick = () => {
    const { window: { document } } = browser;
    const file = document.getElementById('fileOpen'); 
    file.onchange = async (evt) => {
      const { target: { files: [ file ] } } = evt;
      if (file) {
        console.log(file);
      }
    };
    file.click();
  };
  const onSaveClick = () => {
    const file = document.getElementById('fileSave'); 
  };
  const onCloseClick = () => {
    browser.close();
  };
  // create menu bar
  const menuBar = new nw.Menu({ type: 'menubar' });
  const fileMenu = new nw.Menu();
  fileMenu.append(new nw.MenuItem({ label: 'Open', click: onOpenClick }));
  fileMenu.append(new nw.MenuItem({ label: 'Save', click: onSaveClick }));
  fileMenu.append(new nw.MenuItem({ type: 'separator' }));
  fileMenu.append(new nw.MenuItem({ label: (isMac) ? 'Close' : 'Quit', click: onCloseClick }));
  menuBar.append(new nw.MenuItem({ label: 'File', submenu: fileMenu }));
  browser.menu = menuBar;    
});
