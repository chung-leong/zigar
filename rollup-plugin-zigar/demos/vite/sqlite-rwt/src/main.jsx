import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <base href={import.meta.env.BASE_URL} />
    <App />
  </StrictMode>,
)
