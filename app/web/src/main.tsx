import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App.tsx'
import { I18nProvider } from './lib/i18n'
import { followSystemTheme } from './lib/theme'
import './index.css'

followSystemTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
)
