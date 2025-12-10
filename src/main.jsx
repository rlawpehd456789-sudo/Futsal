import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// window.storage API mock (localStorage 기반)
if (!window.storage) {
  window.storage = {
    get: async (key) => {
      try {
        const value = localStorage.getItem(key);
        if (value === null) {
          return null;
        }
        return { value };
      } catch (error) {
        console.error('Storage get error:', error);
        return null;
      }
    },
    set: async (key, value, overwrite = true) => {
      try {
        if (overwrite || !localStorage.getItem(key)) {
          localStorage.setItem(key, value);
          return true;
        }
        return false;
      } catch (error) {
        console.error('Storage set error:', error);
        return false;
      }
    },
    remove: async (key) => {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.error('Storage remove error:', error);
        return false;
      }
    }
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

