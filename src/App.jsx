import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import OwnerDashboard from './pages/OwnerDashboard'
import AdminDashboard from './pages/AdminDashboard'
import FrontDesk from './pages/FrontDesk'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session) setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) {
        setProfile(null)
        setLoading(false)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    setLoading(true)
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        setProfile(data || null)
        setActiveView(data?.role || null)
        setLoading(false)
        if (error) console.error(error)
      })
  }, [session])

  if (loading) {
    return (
      <div className="login-wrap">
        <div className="subtext">Loading…</div>
      </div>
    )
  }

  if (!session || !profile) {
    return <Login />
  }

  const canSwitch = profile.role === 'admin'

  return (
    <div className="app">
      <div className="sidebar">
        <div className="brand">
          One Lakeshore
          <span>Resident Portal</span>
        </div>
        {canSwitch && (
          <div className="nav-links">
            <button
              className={activeView === 'admin' ? 'active' : ''}
              onClick={() => setActiveView('admin')}
            >
              Admin View
            </button>
            <button
              className={activeView === 'frontdesk' ? 'active' : ''}
              onClick={() => setActiveView('frontdesk')}
            >
              Front Desk View
            </button>
          </div>
        )}
        <div className="sidebar-foot">
          {profile.full_name}
          <br />
          {profile.role}
          <br />
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>
      <div className="main">
        {activeView === 'owner' && <OwnerDashboard profile={profile} />}
        {activeView === 'admin' && <AdminDashboard profile={profile} />}
        {activeView === 'frontdesk' && <FrontDesk profile={profile} />}
      </div>
    </div>
  )
}