import { useCallback, useDeferredValue, useEffect, useState } from 'react';

function App() {
  const [ screen, setScreen ] = useState('main')
  const [ albums, setAlbums ] = useState([])
  const [ tracks, setTracks ] = useState([])
  const [ searchString, setSearchString ] = useState('')
  const [ title, setTitle ] = useState('')
  const [ artist, setArtist ] = useState('')
  const [ error, setError ] = useState('')
  const [ selectedAlbumId, setSelectedAlbumId ] = useState()
  const deferredSearchString = useDeferredValue(searchString)

  const onSearchChange = useCallback((evt) => {
    setSearchString(evt.target.value)
  }, [])
  const onAlbumClick = useCallback((evt) => {
    if (evt.target.tagName === 'LI') {
      setSelectedAlbumId(parseInt(evt.target.dataset.albumId))
    }
  }, [])
  const onAddClick = useCallback((evt) => {
    setScreen('add')
  })
  const onTitleChange = useCallback((evt) => {
    setTitle(evt.target.value)
  })
  const onArtistChange = useCallback((evt) => {
    setArtist(evt.target.value)
  })
  const onSaveClick = useCallback(async (evt) => {
    try {
      await window.electron.ipcRenderer.invoke('addAlbum', { Title: title, Artist: artist })
      setScreen('main')
      setTitle('')
      setArtist('')
    } catch (err) {
      setError(err.message);
    }
  })
  const onCancelClick = useCallback((evt) => {
    setScreen('main')
  })
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
        setSelectedAlbumId(undefined)
      }
    }
  }, [ albums ])
  switch (screen) {
    case 'add':
      return (
        <div id="form-add">
          <section>
            <label htmlFor="title">Title:</label>
            <input id="title" value={title} onChange={onTitleChange} />
          </section>
          <section>
            <label htmlFor="title">Artist:</label>
            <input id="artist" value={artist} onChange={onArtistChange} />
          </section>
          <section>
            <div id="error">{error}</div>
          </section>
          <section>
            <button onClick={onSaveClick}>Save</button>
            <button onClick={onCancelClick}>Cancel</button>
          </section>
        </div>
      )
    default:
      return (
        <>
          <div id="header">
            <input id="search" value={searchString} onChange={onSearchChange} />
            <div id="toolbar">
              <button onClick={onAddClick}>Add</button>
            </div>
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
}

function formatTime(ms) {
  const min = Math.floor(ms / 60000).toString()
  let sec = Math.floor((ms % 60000) / 1000).toString()
  if (sec.length == 1) {
    sec = '0' + sec;
  }
  return `${min}:${sec}`
}

export default App

