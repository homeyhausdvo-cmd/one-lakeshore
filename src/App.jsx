import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Register from './pages/Register'
import OwnerDashboard from './pages/OwnerDashboard'
import AdminDashboard from './pages/AdminDashboard'
import FrontDesk from './pages/FrontDesk'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState(null)
  const [showRegister, setShowRegister] = useState(false)

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
    return showRegister ? (
      <Register onDone={() => setShowRegister(false)} />
    ) : (
      <Login onRegister={() => setShowRegister(true)} />
    )
  }

  // Gate access for owners whose registration hasn't been approved yet
  if (profile.role === 'owner' && profile.approval_status !== 'approved') {
    return (
      <div className="login-wrap">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="brand" style={{ color: 'var(--primary)' }}>One Lakeshore</div>
          {profile.approval_status === 'pending' ? (
            <>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 18 }}>Registration pending</h2>
              <p className="subtext" style={{ marginTop: 10 }}>
                Your registration for Unit {profile.requested_unit_number} ({profile.requested_tower})
                is being reviewed. You'll get access once it's approved.
              </p>
            </>
          ) : (
            <>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: 'var(--red)' }}>
                Registration not approved
              </h2>
              <p className="subtext" style={{ marginTop: 10 }}>
                Please contact building management to resolve this.
              </p>
            </>
          )}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    )
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
            <button className={activeView === 'admin' ? 'active' : ''} onClick={() => setActiveView('admin')}>
              Admin View
            </button>
            <button className={activeView === 'frontdesk' ? 'active' : ''} onClick={() => setActiveView('frontdesk')}>
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