import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import PublicRequest from './PublicRequest.jsx'
import TrackRequest from './TrackRequest.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* ADMIN DASHBOARD (Protected by Login in App.jsx) */}
        <Route path="/" element={<App />} />
        
        {/* PUBLIC ROUTES (No Login Required) */}
        <Route path="/request" element={<PublicRequest />} />
        <Route path="/track" element={<TrackRequest />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)