import { useCallback, useDeferredValue, useEffect, useState } from 'react';

function App() {
  const [ albums, setAlbums ] = useState([])
  const [ tracks, setTracks ] = useState([])
  const [ searchString, setSearchString ] = useState('')
  const [ selectedAlbumId, setSelectedAlbumId ] = useState()
  const deferredSearchString = useDeferredValue(searchString)

  const onSearchChange = useCallback((evt) => {
    setSearchString(evt.target.value);
  }, []);
  const onAlbumClick = useCallback((evt) => {
    if (evt.target.tagName === 'LI') {
      setSelectedAlbumId(parseInt(evt.target.dataset.albumId));
    }
  }, []);
  useEffect(() => {
    window.electron.ipcRenderer.invoke('findAlbums', deferredSearchString).then(setAlbums)
  }, [ deferredSearchString ])
  useEffect(() => {
    if (selectedAlbumId !== undefined) {
      window.electron.ipcRenderer.invoke('getTracks', selectedAlbumId).then(setTracks)
    } else {
      setTracks([])
    }
  }, [ selectedAlbumId ])
  useEffect(() => {
    if (selectedAlbumId) {
      if (!albums.find(a => a.AlbumId === selectedAlbumId)) {
        setSelectedAlbumId(undefined);
      }
    }
  }, [ albums ]);

  return (
    <>
      <div id="header">
        <input id="search" value={searchString} onChange={onSearchChange} />
        <div id="toolbar"></div>
      </div>
      <div id="content">
        <ul id="album-list" onClick={onAlbumClick}>
          {albums.map(album =>
            <li className={album.AlbumId === selectedAlbumId ? 'selected' : ''} data-album-id={album.AlbumId}>{album.Title}</li>)
          }
        </ul>
        <ul id="track-list">
          {tracks.map(track =>
            <li data-track-id={track.TrackId}>[{formatTime(track.Milliseconds)}] {track.Name}</li>)
          }
        </ul>
      </div>
    </>
  )
}

function formatTime(ms) {
  const min = Math.floor(ms / 60000).toString();
  let sec = Math.floor((ms % 60000) / 1000).toString();
  if (sec.length == 1) {
    sec = '0' + sec;
  }
  return `${min}:${sec}`;
}

export default App

