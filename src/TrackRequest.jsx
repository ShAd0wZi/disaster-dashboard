import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from './firebase'
import { Link } from 'react-router-dom'

function TrackRequest() {
  const [id, setId] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  
  // --- NEW: DARK MODE STATE ---
  const [darkMode, setDarkMode] = useState(false)

  // 1. Check preference on load
  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    } else {
      setDarkMode(false)
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // 2. Toggle Function
  const toggleTheme = () => {
    if (darkMode) {
      document.documentElement.classList.remove('dark')
      localStorage.theme = 'light'
      setDarkMode(false)
    } else {
      document.documentElement.classList.add('dark')
      localStorage.theme = 'dark'
      setDarkMode(true)
    }
  }

  const checkStatus = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus(null)

    try {
      const docRef = doc(db, "requests", id.trim())
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        setStatus(docSnap.data().status)
      } else {
        alert("Request ID not found. Check your code.")
      }
    } catch (err) { alert("Error checking status") }
    setLoading(false)
  }

  const getStatusColor = (s) => {
    if (s === 'pending') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-700'
    if (s === 'approved') return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700'
    if (s === 'dispatched') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700'
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 flex items-center justify-center transition-colors duration-300 relative">
      
      {/* THEME TOGGLE BUTTON */}
      <button onClick={toggleTheme} className="absolute top-4 right-4 p-3 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 text-xl transition-transform hover:scale-110 z-10">
        {darkMode ? '☀️' : '🌙'}
      </button>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md border-t-4 border-indigo-600 dark:border-indigo-500 transition-colors">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">Track Your Aid</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Enter your tracking ID to see live updates.</p>
        </div>

        <form onSubmit={checkStatus} className="flex gap-2 mb-8">
          <input 
            type="text" placeholder="Paste Request ID" 
            className="flex-1 p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-mono text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            value={id} onChange={e => setId(e.target.value)}
          />
          <button disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition transform active:scale-95">
            {loading ? "..." : "Check"}
          </button>
        </form>

        {status && (
          <div className={`p-6 rounded-2xl text-center border-2 transition-all ${status === 'pending' ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-500' : 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10 dark:border-indigo-500'}`}>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-3">Current Status</p>
            
            <span className={`px-4 py-2 rounded-full text-lg font-bold capitalize shadow-sm ${getStatusColor(status)}`}>
              {status}
            </span>
            
            <p className="mt-6 text-sm text-slate-600 dark:text-slate-300 font-medium">
              {status === 'pending' && "Your request is in the queue waiting for verification."}
              {status === 'approved' && "✓ Verified. We are currently locating a relief truck for your area."}
              {status === 'dispatched' && "🚚 Relief is on the way to your pinned location."}
            </p>
          </div>
        )}

        <div className="mt-8 text-center border-t border-slate-100 dark:border-slate-700 pt-6">
          <Link to="/request" className="text-slate-500 dark:text-slate-400 text-sm font-bold hover:text-indigo-600 dark:hover:text-indigo-400 transition">
            ← Submit A New Request
          </Link>
        </div>
      </div>
    </div>
  )
}

export default TrackRequest