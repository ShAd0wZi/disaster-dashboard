import { useState, useEffect } from 'react'
import { collection, addDoc } from 'firebase/firestore'
import { db } from './firebase'
import { Link } from 'react-router-dom'

function PublicRequest() {
  const [district, setDistrict] = useState('')
  const [item, setItem] = useState('')
  const [phone, setPhone] = useState('')
  const [urgency, setUrgency] = useState('Medium')
  const [coords, setCoords] = useState({ lat: null, lng: null })
  
  const [loading, setLoading] = useState(false)
  const [successID, setSuccessID] = useState(null) 
  
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

  // --- FEATURE: GPS BUTTON ---
  const getLoc = (e) => {
    e.preventDefault()
    if (!navigator.geolocation) return alert("GPS not supported by your browser")
    setLoading(true)
    navigator.geolocation.getCurrentPosition((position) => {
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude })
      setLoading(false)
      alert("Location Pinned! ✅")
    }, () => {
      setLoading(false)
      alert("Could not get GPS. Please type your City Name.")
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const docRef = await addDoc(collection(db, "requests"), {
        district, item, phone, urgency,
        lat: coords.lat, lng: coords.lng,
        status: 'pending', timestamp: new Date()
      })
      setSuccessID(docRef.id) 
      setDistrict(''); setItem(''); setPhone('')
    } catch (err) { alert("Error: " + err.message) }
    setLoading(false)
  }

  // --- VIEW: SUCCESS SCREEN ---
  if (successID) {
    return (
      <div className="min-h-screen bg-emerald-50 dark:bg-slate-900 flex items-center justify-center p-4 relative transition-colors duration-300">
        {/* THEME TOGGLE BUTTON */}
        <button onClick={toggleTheme} className="absolute top-4 right-4 p-3 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 text-xl transition-transform hover:scale-110">
          {darkMode ? '☀️' : '🌙'}
        </button>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-md text-center border-t-4 border-emerald-500 w-full transition-colors">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Request Sent!</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Help is being coordinated.</p>
          
          <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-xl mb-6 border border-slate-200 dark:border-slate-600">
            <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wider mb-1">Your Tracking ID</p>
            <p className="text-xl font-mono font-bold text-indigo-600 dark:text-indigo-400 select-all">{successID}</p>
          </div>
          
          <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">Save this ID to check your status later.</p>
          
          <div className="flex flex-col gap-3">
            <Link to="/track" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition">Track Status</Link>
            <button onClick={() => setSuccessID(null)} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white underline text-sm transition">Submit Another Request</button>
          </div>
        </div>
      </div>
    )
  }

  // --- VIEW: FORM SCREEN ---
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 flex items-center justify-center transition-colors duration-300 relative">
      
      {/* THEME TOGGLE BUTTON */}
      <button onClick={toggleTheme} className="absolute top-4 right-4 p-3 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 text-xl transition-transform hover:scale-110 z-10">
        {darkMode ? '☀️' : '🌙'}
      </button>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md border-t-4 border-indigo-600 dark:border-indigo-500 transition-colors">
        <h1 className="text-2xl font-bold text-center mb-2 text-slate-800 dark:text-white">Request Aid</h1>
        <p className="text-center text-slate-500 dark:text-slate-400 text-sm mb-6">Fill this form to alert the relief team.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Where are you?</label>
            <div className="flex gap-2">
              <input required type="text" placeholder="City / Village" className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition" 
                value={district} onChange={e => setDistrict(e.target.value)} />
              
              <button onClick={getLoc} className={`px-4 rounded-xl text-white font-bold whitespace-nowrap transition shadow-sm ${coords.lat ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-500 hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500'}`}>
                {coords.lat ? "✓ Pinned" : "📍 GPS"}
              </button>
            </div>
            {coords.lat && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-bold">Exact location secured.</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">What do you need?</label>
            <input required type="text" placeholder="Water, Rice, Medicine..." className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition" 
              value={item} onChange={e => setItem(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Phone Number</label>
            <input required type="tel" placeholder="07x xxxxxxx" className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition" 
              value={phone} onChange={e => setPhone(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Urgency Level</label>
            <select className="w-full p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition" value={urgency} onChange={e => setUrgency(e.target.value)}>
              <option>Medium</option><option>High</option><option>Critical (Life Threatening)</option>
            </select>
          </div>

          <button disabled={loading} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition transform active:scale-95 mt-4">
            {loading ? "Sending Request..." : "Submit Request"}
          </button>
        </form>
        
        <div className="text-center mt-6 border-t border-slate-100 dark:border-slate-700 pt-4">
           <Link to="/track" className="text-sm text-indigo-500 dark:text-indigo-400 font-bold hover:underline">Check Request Status</Link>
        </div>
      </div>
    </div>
  )
}

export default PublicRequest