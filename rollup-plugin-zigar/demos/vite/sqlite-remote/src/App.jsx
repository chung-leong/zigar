import { useCallback, useDeferredValue, useEffect, useState } from 'react';
import { __zigar, closeDb, findAlbums, getTracks, openDb, startup } from '../zig/sqlite.zig';
import './App.css';
import chinook from './assets/chinook.jpg';
import { WebFile } from './web-file.js';

startup()

let data;

__zigar.on('open', async (evt) => {
  if (evt.path.endsWith('.sqlite3')) {
    return data ??= WebFile.create(chinook)
  } else {
    return false;
  }
})
__zigar.on('mkdir', () => true)
__zigar.on('rmdir', () => true)

function App() {
  const [ albums, setAlbums ] = useState([])
  const [ tracks, setTracks ] = useState([])
  const [ searchString, setSearchString ] = useState('')
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
  useEffect(() => {
    openDb('/db.sqlite3')
    return () => closeDb()
  }, [ openDb, closeDb ])
  useEffect(() => {
    findAlbums(deferredSearchString || '%').then(setAlbums)
  }, [ deferredSearchString, findAlbums ])
  useEffect(() => {
    if (selectedAlbumId !== undefined) {
      getTracks(selectedAlbumId).then(setTracks)
    } else {
      setTracks([])
    }
  }, [ selectedAlbumId, getTracks ])
  useEffect(() => {
    if (selectedAlbumId) {
      if (!albums.find(a => a.AlbumId === selectedAlbumId)) {
        setSelectedAlbumId(undefined)
      }
    }
  }, [ albums ])
  return (
    <>
      <div id="header">
        <input id="search" value={searchString} onChange={onSearchChange} />
      </div>
      <div id="content">
        <ul id="album-list" onClick={onAlbumClick}>
          {albums.map(album =>
            <li 
              key={album.AlbumId} 
              className={album.AlbumId === selectedAlbumId ? 'selected' : ''} 
              data-album-id={album.AlbumId}
              title={album.Artist}
            >
              {album.Title}
            </li>
          )}
        </ul>
        <ul id="track-list">
          {
            tracks.map(track =>
              <li 
                key={track.TrackId} 
                data-track-id={track.TrackId}
              >
                [{formatTime(track.Milliseconds)}] {track.Name}
              </li>
            )
          }
        </ul>
      </div>
    </>
  )
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
