import { FileTree, utils } from '@sinm/react-file-tree';
import '@sinm/react-file-tree/icons.css';
import FileItemWithFileIcon from '@sinm/react-file-tree/lib/FileItemWithFileIcon';
import '@sinm/react-file-tree/styles.css';
import { startTransition, useCallback, useEffect, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { extract, shutdown, startup } from '../zig/decompress.zig';
import './App.css';

const decoder = new TextDecoder;
const ext2lang = {
  h: 'c',
  c: 'c',
  hpp: 'cpp',
  cpp: 'cpp',
  js: 'javascript',
};

function App() {
  const [ tree, setTree ] = useState(null);
  const [ codeString, setCodeString ] = useState('');
  const [ language, setLanguage ] = useState('');
  const treeProps = {
    tree,
    itemRenderer: (treeNode) => <FileItemWithFileIcon treeNode={treeNode} />,
    onItemClick: useCallback(({ uri, type, data, expanded }) => {
      startTransition(() => {
        if (type === 'directory') {
          setTree(tree => utils.assignTreeNode(tree, uri, { expanded: !expanded }));
        } else {
          const code = decoder.decode(data);
          const slashIndex = uri.lastIndexOf('/');
          const dotIndex = uri.lastIndexOf('.');
          const ext = (dotIndex > slashIndex) ? uri.slice(dotIndex + 1) : '';
          setCodeString(code);
          setLanguage(ext2lang[ext] ?? ext);
        }
      });
    }, []),
  };
  const highlightProps = {
    language,
    showLineNumbers: true,
    style: dark,
    customStyle: {
      backgroundColor: null,
      border: null,
      boxShadow: null,
      padding: null,
      margin: 0,
    },
  };
  useEffect(() => {
    let unmounted = false;    
    async function load() {
      startup();
      const response = await fetch('https://corsproxy.io/?url=https://github.com/ziglang/zig/archive/refs/tags/0.1.1.tar.gz');
      const reader = response.body.getReader()
      try {
        for await (const file of await extract(reader)) {
          if (unmounted) break;
          startTransition(() => {
            setTree((tree) => {
              const uri = file.name.string.replace(/\/$/, '');
              const slashIndex = uri.lastIndexOf('/');
              if (slashIndex === -1) {
                return { uri, expanded: true };
              } else {
                const parentUri = uri.slice(0, slashIndex);
                const node = (file.kind == 'directory') 
                ? { uri, type: 'directory', expanded: false }
                : { uri, type: 'file', data: file.data.typedArray };
                return utils.appendTreeNode(tree, parentUri, node);
              }
            });
          });
        }
      } finally {
        await shutdown();
      }
    }
    load();
    return () => unmounted = true;
  }, []);
  return (
    <>
      <div id="left-pane">
        <FileTree {...treeProps} />
      </div>
      <div id="right-pane">
        <SyntaxHighlighter {...highlightProps}>
          {codeString}
        </SyntaxHighlighter>
      </div>
    </>
  )
}

export default App

