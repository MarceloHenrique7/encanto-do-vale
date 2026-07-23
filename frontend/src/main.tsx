import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initializeMetaPixel } from './lib/metaPixel'
import './styles/components.css'
import './styles/delivery.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

initializeMetaPixel()

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
