import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { collection, onSnapshot, updateDoc, deleteDoc, doc, addDoc, getDoc } from 'firebase/firestore'
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth'
import { db, auth } from './firebase'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// --- 1. DATA & CONFIG ---
const DISTRICT_COORDS = {
  "colombo": { lat: 6.9271, lng: 79.8612 },
  "gampaha": { lat: 7.0840, lng: 79.9939 },
  "kalutara": { lat: 6.5854, lng: 79.9607 },
  "kandy": { lat: 7.2906, lng: 80.6337 },
  "matale": { lat: 7.4675, lng: 80.6234 },
  "nuwara eliya": { lat: 6.9497, lng: 80.7891 },
  "galle": { lat: 6.0535, lng: 80.2210 },
  "matara": { lat: 5.9549, lng: 80.5550 },
  "hambantota": { lat: 6.1429, lng: 81.1212 },
  "jaffna": { lat: 9.6615, lng: 80.0255 },
  "kilinochchi": { lat: 9.3803, lng: 80.4121 },
  "mannar": { lat: 8.9766, lng: 79.9043 },
  "vavuniya": { lat: 8.7514, lng: 80.4971 },
  "mullaitivu": { lat: 9.2671, lng: 80.8142 },
  "batticaloa": { lat: 7.7310, lng: 81.6747 },
  "ampara": { lat: 7.2817, lng: 81.6747 },
  "trincomalee": { lat: 8.5874, lng: 81.2152 },
  "kurunegala": { lat: 7.4863, lng: 80.3649 },
  "puttalam": { lat: 8.0408, lng: 79.8394 },
  "anuradhapura": { lat: 8.3114, lng: 80.4037 },
  "polonnaruwa": { lat: 7.9403, lng: 81.0188 },
  "badulla": { lat: 6.9934, lng: 81.0550 },
  "monaragala": { lat: 6.8714, lng: 81.3487 },
  "ratnapura": { lat: 6.6828, lng: 80.3992 },
  "kegalle": { lat: 7.2513, lng: 80.3464 },
  "default": { lat: 7.8731, lng: 80.7718 }
}

const getMarkerIcon = (urgency, item) => {
  let iconHtml = '📍'; let colorClass = 'bg-blue-500'
  const lowerItem = item.toLowerCase()
  
  if (lowerItem.includes('water')) iconHtml = '💧'
  else if (lowerItem.includes('medicine') || lowerItem.includes('health')) iconHtml = '🏥'
  else if (lowerItem.includes('food') || lowerItem.includes('rice')) iconHtml = '🍚'
  else if (lowerItem.includes('cloth')) iconHtml = '👕'
  
  if (urgency === 'Critical') colorClass = 'bg-red-600 animate-pulse'
  else if (urgency === 'High') colorClass = 'bg-orange-500'
  else if (urgency === 'Low') colorClass = 'bg-green-500'
  
  return L.divIcon({
    className: 'custom-icon',
    html: `<div class="${colorClass} w-8 h-8 rounded-full flex items-center justify-center text-white border-2 border-white shadow-lg text-sm">${iconHtml}</div>`
  })
}

function App() {
  // --- 2. STATE MANAGEMENT ---
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState('dark')
  
  // Admin State
  const [view, setView] = useState('map') 
  const [requests, setRequests] = useState([])
  const [filterMode, setFilterMode] = useState('ALL') 
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Public State
  const [publicMode, setPublicMode] = useState('LOGIN') // 'LOGIN', 'FORM', 'TRACK', 'SUCCESS'
  const [reqData, setReqData] = useState({ district: '', item: '', phone: '', urgency: 'High', gpsLat: null, gpsLng: null })
  const [trackId, setTrackId] = useState('')
  const [lastSubmittedId, setLastSubmittedId] = useState('') // New: For the success screen
  const [trackResult, setTrackResult] = useState(null)
  const [gpsLoading, setGpsLoading] = useState(false)

  // --- 3. EFFECTS ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false) })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      const unsubscribe = onSnapshot(collection(db, "requests"), (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setRequests(data)
      })
      return () => unsubscribe()
    }
  }, [user])

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [theme])

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light')

  // --- 4. ADMIN ACTIONS ---
  const handleLogin = async (e) => { 
    e.preventDefault(); 
    try { await signInWithEmailAndPassword(auth, email, password) } catch (err) { alert(err.message) } 
  }

  const approveRequest = async (req) => {
    // LOGIC UPDATE: Use user's GPS if they sent it, otherwise use District Center + Jitter
    let finalLat, finalLng

    if (req.gpsLat && req.gpsLng) {
      finalLat = req.gpsLat
      finalLng = req.gpsLng
    } else {
      const districtKey = req.district.toLowerCase().trim()
      const baseCoords = DISTRICT_COORDS[districtKey] || DISTRICT_COORDS["default"]
      // Add Jitter
      finalLat = baseCoords.lat + (Math.random() - 0.5) * 0.05
      finalLng = baseCoords.lng + (Math.random() - 0.5) * 0.05
    }

    try {
      await updateDoc(doc(db, "requests", req.id), { status: 'approved', lat: finalLat, lng: finalLng })
    } catch (err) { alert(err.message) }
  }

  const deleteRequest = async (id) => {
    if(confirm("Permanently delete this request?")) await deleteDoc(doc(db, "requests", id))
  }

  const exportData = () => {
    const headers = ["District,Item,Urgency,Phone,Latitude,Longitude,ExactGPS\n"]
    const rows = visibleRequests.map(req => `${req.district},${req.item},${req.urgency},${req.phone || 'N/A'},${req.lat},${req.lng},${req.gpsLat ? 'Yes' : 'No'}`)
    const csvContent = headers.concat(rows).join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `relief_ops_${filterMode}.csv`; link.click()
  }

  // --- 5. PUBLIC ACTIONS ---
  
  // New: Get GPS Function
  const handleGetLocation = () => {
    if (!navigator.geolocation) return alert("Geolocation not supported by this browser.")
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setReqData({ ...reqData, gpsLat: position.coords.latitude, gpsLng: position.coords.longitude })
        setGpsLoading(false)
      },
      () => {
        alert("Unable to retrieve location.")
        setGpsLoading(false)
      }
    )
  }

  // New: Copy Function
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    alert("Copied to clipboard!")
  }

  const submitPublicRequest = async (e) => {
    e.preventDefault()
    if(!reqData.district || !reqData.item) return alert("Please fill in required fields")
    
    try {
      const docRef = await addDoc(collection(db, "requests"), {
        ...reqData,
        status: 'pending',
        timestamp: new Date()
      })
      setLastSubmittedId(docRef.id)
      setPublicMode('SUCCESS') // Move to success screen instead of alert
      setReqData({ district: '', item: '', phone: '', urgency: 'High', gpsLat: null, gpsLng: null }) // Reset
    } catch (err) { alert("Error submitting: " + err.message) }
  }

  const checkStatus = async (e) => {
    e.preventDefault()
    if(!trackId) return
    try {
      const docSnap = await getDoc(doc(db, "requests", trackId.trim()))
      if (docSnap.exists()) setTrackResult(docSnap.data())
      else setTrackResult("NOT_FOUND")
    } catch (err) { alert("Error checking: " + err.message) }
  }

  // --- 6. FILTER LOGIC ---
  const pendingRequests = requests.filter(r => r.status === 'pending')
  const approvedRequests = requests.filter(r => r.status !== 'pending')
  const isCritical = (urgency) => urgency && urgency.toLowerCase().includes('critical')
  
  const criticalCount = approvedRequests.filter(r => isCritical(r.urgency)).length
  const activeCount = approvedRequests.length
  const pendingCount = pendingRequests.length

  const visibleRequests = approvedRequests.filter(req => {
    if (filterMode === 'ALL') return true
    if (filterMode === 'CRITICAL') return isCritical(req.urgency)
    if (filterMode === 'WATER') return req.item.toLowerCase().includes('water')
    if (filterMode === 'MEDICAL') return req.item.toLowerCase().includes('medicine') || req.item.toLowerCase().includes('health')
    return true
  })

  // --- 7. RENDER ---
  if (loading) return <div className="flex h-screen items-center justify-center text-gray-500 font-medium dark:bg-slate-900 dark:text-slate-400">Loading System...</div>

  // === VIEW: PUBLIC HUB ===
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="bg-white/10 backdrop-blur-lg border border-white/10 p-8 rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
          
          <h1 className="text-3xl font-bold mb-2 text-center text-white tracking-tight">Relief Ops <span className="text-blue-400">Lanka</span></h1>
          <p className="text-center text-slate-400 text-sm mb-8">Disaster Response Coordination System</p>

          {/* MODE: LOGIN */}
          {publicMode === 'LOGIN' && (
            <div className="space-y-4 animate-in fade-in zoom-in duration-300">
              <form onSubmit={handleLogin} className="space-y-4">
                <input type="email" placeholder="Admin Email" className="w-full p-3 bg-slate-800/50 border border-slate-600 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500" onChange={(e) => setEmail(e.target.value)}/>
                <input type="password" placeholder="Password" className="w-full p-3 bg-slate-800/50 border border-slate-600 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500" onChange={(e) => setPassword(e.target.value)}/>
                <button className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold shadow-lg transition-transform hover:scale-[1.02]">Admin Login</button>
              </form>
              
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-700"></div>
                <span className="flex-shrink mx-4 text-slate-500 text-xs uppercase">Public Services</span>
                <div className="flex-grow border-t border-slate-700"></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setPublicMode('FORM')} className="bg-emerald-600/20 border border-emerald-500/50 hover:bg-emerald-600/40 text-emerald-400 py-3 rounded-xl font-bold text-sm transition">📢 Request Help</button>
                <button onClick={() => setPublicMode('TRACK')} className="bg-purple-600/20 border border-purple-500/50 hover:bg-purple-600/40 text-purple-400 py-3 rounded-xl font-bold text-sm transition">🔍 Track Status</button>
              </div>
            </div>
          )}

          {/* MODE: REQUEST FORM */}
          {publicMode === 'FORM' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
              <div className="flex items-center gap-2 mb-4 text-emerald-400">
                <button onClick={() => setPublicMode('LOGIN')} className="hover:bg-white/10 p-1 rounded">←</button>
                <h2 className="font-bold text-lg">Submit Request</h2>
              </div>
              
              <form onSubmit={submitPublicRequest} className="space-y-3">
                 <select className="w-full p-3 bg-slate-800/50 border border-slate-600 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" value={reqData.district} onChange={(e) => setReqData({...reqData, district: e.target.value})} required>
                   <option value="">Select District (General Area)</option>
                   {Object.keys(DISTRICT_COORDS).filter(k => k !== 'default').map(d => (
                     <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                   ))}
                 </select>
                 <input type="text" placeholder="What do you need? (Water, Rice, Meds)" className="w-full p-3 bg-slate-800/50 border border-slate-600 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" onChange={(e) => setReqData({...reqData, item: e.target.value})} required/>
                 <input type="text" placeholder="Phone Number" className="w-full p-3 bg-slate-800/50 border border-slate-600 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" onChange={(e) => setReqData({...reqData, phone: e.target.value})}/>
                 
                 {/* GPS BUTTON */}
                 <button type="button" onClick={handleGetLocation} className={`w-full py-3 rounded-xl font-bold text-sm border flex items-center justify-center gap-2 transition ${reqData.gpsLat ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-slate-800/50 border-slate-600 text-slate-400 hover:bg-slate-700'}`}>
                    {gpsLoading ? 'Getting Location...' : (reqData.gpsLat ? '✅ Location Locked (Precision GPS)' : '📍 Share My Exact GPS Location')}
                 </button>

                 <div className="flex gap-2">
                   {['Low', 'High', 'Critical'].map(level => (
                     <button type="button" key={level} onClick={() => setReqData({...reqData, urgency: level})} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${reqData.urgency === level ? (level === 'Critical' ? 'bg-red-500 border-red-500 text-white' : 'bg-emerald-500 border-emerald-500 text-white') : 'border-slate-600 text-slate-400 hover:bg-slate-700'}`}>{level}</button>
                   ))}
                 </div>
                 <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-3 rounded-xl font-bold shadow-lg mt-2">Submit Request</button>
              </form>
            </div>
          )}

          {/* MODE: SUCCESS SCREEN (NEW) */}
          {publicMode === 'SUCCESS' && (
             <div className="space-y-6 text-center animate-in fade-in zoom-in duration-300">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto text-3xl shadow-lg shadow-green-500/50">✓</div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Request Received</h2>
                  <p className="text-slate-400 text-sm">Save your Tracking ID below to check status later.</p>
                </div>
                
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-600 flex items-center justify-between gap-3">
                  <code className="text-blue-400 font-mono text-lg font-bold">{lastSubmittedId}</code>
                  <button onClick={() => copyToClipboard(lastSubmittedId)} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded-lg text-xs font-bold">COPY</button>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setPublicMode('LOGIN')} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold text-sm">Home</button>
                  <button onClick={() => { setTrackId(lastSubmittedId); setPublicMode('TRACK'); }} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold text-sm">Track Now</button>
                </div>
             </div>
          )}

          {/* MODE: TRACKING */}
          {publicMode === 'TRACK' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
               <div className="flex items-center gap-2 mb-4 text-purple-400">
                <button onClick={() => { setPublicMode('LOGIN'); setTrackResult(null); }} className="hover:bg-white/10 p-1 rounded">←</button>
                <h2 className="font-bold text-lg">Track Status</h2>
              </div>
              <form onSubmit={checkStatus} className="flex gap-2">
                <input type="text" value={trackId} placeholder="Enter Request ID" className="flex-1 p-3 bg-slate-800/50 border border-slate-600 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500" onChange={(e) => setTrackId(e.target.value)}/>
                <button className="bg-purple-600 hover:bg-purple-500 text-white px-4 rounded-xl font-bold">Check</button>
              </form>
              {trackResult === "NOT_FOUND" && <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-center text-red-300 text-sm">ID Not Found. Please check and try again.</div>}
              {trackResult && trackResult !== "NOT_FOUND" && (
                <div className="p-4 bg-slate-800/80 border border-slate-600 rounded-xl space-y-2">
                   <div className="flex justify-between"><span className="text-slate-400 text-xs uppercase">Item</span><span className="text-white font-bold">{trackResult.item}</span></div>
                   <div className="flex justify-between"><span className="text-slate-400 text-xs uppercase">District</span><span className="text-white font-bold">{trackResult.district}</span></div>
                   <div className="mt-4 pt-4 border-t border-slate-700 text-center">
                     <span className="block text-slate-500 text-xs uppercase mb-1">Current Status</span>
                     <span className={`text-xl font-black uppercase ${trackResult.status === 'approved' ? 'text-green-400' : 'text-yellow-400'}`}>{trackResult.status === 'approved' ? '✅ On The Map' : '⏳ Pending Review'}</span>
                     {trackResult.status === 'approved' && <p className="text-xs text-slate-400 mt-1">Help is on the way.</p>}
                   </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // === VIEW: ADMIN DASHBOARD (Protected) ===
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900 font-sans transition-colors duration-300">
      {/* SIDEBAR */}
      <div className="w-1/3 flex flex-col border-r border-gray-200 dark:border-slate-700 shadow-xl z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl relative transition-colors duration-300">
        
        {/* HEADER */}
        <div className="p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 border-b border-gray-100/50 dark:border-slate-700/50 transition-colors duration-300">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">Command Center</h1>
            <div className="flex gap-4 items-center">
              <button onClick={toggleTheme} className="p-2 rounded-full bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-yellow-400 hover:scale-110 transition-transform">{theme === 'light' ? '🌙' : '☀️'}</button>
              <button onClick={() => signOut(auth)} className="text-xs font-semibold text-red-500 hover:text-red-700 transition">Logout</button>
            </div>
          </div>
          
          {/* STATS */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 p-3 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center group">
              <span className="block text-2xl font-black text-red-500 group-hover:scale-110 transition-transform">{criticalCount}</span>
              <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">Critical</span>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-900/30 p-3 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center group">
              <span className="block text-2xl font-black text-blue-500 group-hover:scale-110 transition-transform">{activeCount}</span>
              <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">Active</span>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-yellow-100 dark:border-yellow-900/30 p-3 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center group">
              <span className="block text-2xl font-black text-yellow-500 group-hover:scale-110 transition-transform">{pendingCount}</span>
              <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">Pending</span>
            </div>
          </div>

          {/* FILTERS */}
          <div className="mb-6">
            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 mb-3 uppercase tracking-widest pl-1">Map Filters</p>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <button onClick={() => setFilterMode('ALL')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${filterMode === 'ALL' ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-slate-300 dark:shadow-none' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>ALL</button>
                <button onClick={() => setFilterMode('CRITICAL')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${filterMode === 'CRITICAL' ? 'bg-red-500 text-white shadow-red-300 dark:shadow-none animate-pulse' : 'bg-white dark:bg-slate-800 text-red-500 border border-red-100 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20'}`}>CRITICAL</button>
                <button onClick={() => setFilterMode('WATER')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${filterMode === 'WATER' ? 'bg-blue-500 text-white shadow-blue-300 dark:shadow-none' : 'bg-white dark:bg-slate-800 text-blue-500 border border-blue-100 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}>WATER</button>
                <button onClick={() => setFilterMode('MEDICAL')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${filterMode === 'MEDICAL' ? 'bg-emerald-500 text-white shadow-emerald-300 dark:shadow-none' : 'bg-white dark:bg-slate-800 text-emerald-500 border border-emerald-100 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}>MED</button>
            </div>
          </div>

          {/* EXPORT */}
          {activeCount > 0 && (
            <button onClick={exportData} className="w-full mb-6 bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold py-3 rounded-xl hover:bg-black dark:hover:bg-slate-600 transition-all shadow-lg shadow-gray-200 dark:shadow-none flex items-center justify-center gap-2 transform active:scale-95">📥 DOWNLOAD ({filterMode})</button>
          )}

          {/* TABS */}
          <div className="flex bg-gray-100/80 dark:bg-slate-800 p-1 rounded-xl transition-colors">
            <button onClick={() => setView('map')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${view === 'map' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}>Live Map</button>
            <button onClick={() => setView('inbox')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${view === 'inbox' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}>Inbox</button>
          </div>
        </div>

        {/* INBOX CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 dark:bg-slate-900/50 transition-colors">
          {view === 'inbox' && (
            <div className="space-y-4 pb-20">
              <h2 className="font-bold text-gray-400 dark:text-slate-500 text-xs uppercase tracking-wider pl-1">Pending Approval</h2>
              {pendingRequests.length === 0 && <div className="text-center py-10 text-gray-400 dark:text-slate-600 italic text-sm">No pending requests.</div>}
              {pendingRequests.map(req => (
                <div key={req.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-all duration-300 hover:-translate-y-1 group relative overflow-hidden">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${req.urgency === 'Critical' ? 'bg-red-500' : 'bg-yellow-400'}`}></div>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-slate-200 text-lg">{req.item}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">📍 {req.district}</span>
                        {req.gpsLat && <span className="bg-blue-100 text-blue-600 text-[9px] font-bold px-1.5 py-0.5 rounded border border-blue-200">GPS</span>}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">📞 {req.phone || "No Phone"}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide ${req.urgency === 'Critical' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30' : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border border-yellow-100 dark:border-yellow-900/30'}`}>{req.urgency}</span>
                  </div>
                  <div className="flex gap-2 mt-4 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => approveRequest(req)} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2.5 rounded-lg transition shadow-sm">✓ APPROVE</button>
                    <button onClick={() => deleteRequest(req.id)} className="flex-1 bg-gray-50 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-600 dark:text-slate-300 hover:text-red-600 border border-gray-200 dark:border-slate-600 hover:border-red-100 dark:hover:border-red-800 text-xs font-bold py-2.5 rounded-lg transition">DELETE</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ACTIVE OPERATIONS LIST */}
          {view === 'map' && (
            <div className="space-y-3 pb-20">
               <div className="flex justify-between items-center pl-1">
                 <h2 className="font-bold text-gray-400 dark:text-slate-500 text-xs uppercase tracking-wider">Active Operations</h2>
                 <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full text-slate-500 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-700">Showing: {visibleRequests.length}</span>
               </div>
              {visibleRequests.length === 0 && <p className="text-xs text-gray-400 dark:text-slate-600 italic py-10 text-center">No requests match.</p>}
              {visibleRequests.map(req => (
                <div key={req.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-all duration-300 hover:-translate-y-1 group relative">
                   <div className={`absolute top-4 right-4 w-2 h-2 rounded-full ${req.urgency === 'Critical' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-xl bg-gray-50 dark:bg-slate-700 w-10 h-10 rounded-full flex items-center justify-center border border-gray-100 dark:border-slate-600">{req.item.toLowerCase().includes('water') ? '💧' : '📍'}</div>
                    <div><h3 className="font-bold text-sm text-gray-800 dark:text-slate-200 leading-tight">{req.item}</h3><p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{req.district}</p></div>
                  </div>
                  {req.urgency === 'Critical' && <div className="mt-2 mb-2"><span className="inline-block bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-100 dark:border-red-900/30">🚨 Critical Priority</span></div>}
                  <button onClick={() => deleteRequest(req.id)} className="w-full mt-1 text-center text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 text-[10px] font-bold py-1 transition-colors uppercase tracking-widest">Mark Resolved</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MAP AREA */}
      <div className="w-2/3 h-full relative bg-gray-200 dark:bg-slate-800">
        <MapContainer center={[7.8731, 80.7718]} zoom={8} className="h-full w-full outline-none dark:invert dark:hue-rotate-180 dark:brightness-90 dark:contrast-125">
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
          {visibleRequests.map(req => (
             req.lat && req.lng ? (
              <Marker key={req.id} position={[req.lat, req.lng]} icon={getMarkerIcon(req.urgency, req.item)}>
                <Popup className="custom-popup invert-popup">
                  <div className="text-center p-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Location</span>
                    <strong className="block text-lg font-extrabold text-slate-800 leading-none mb-2">{req.district}</strong>
                    <span className="inline-block bg-blue-50 text-blue-600 border border-blue-100 text-xs font-bold px-3 py-1 rounded-full">{req.item}</span>
                    <p className={`mt-3 font-bold uppercase text-[10px] tracking-wider ${req.urgency === 'Critical' ? 'text-red-600' : 'text-green-600'}`}>{req.urgency} Priority</p>
                  </div>
                </Popup>
              </Marker>
            ) : null
          ))}
        </MapContainer>
        <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-black/10 to-transparent z-[400] pointer-events-none"></div>
      </div>
    </div>
  )
}

export default App