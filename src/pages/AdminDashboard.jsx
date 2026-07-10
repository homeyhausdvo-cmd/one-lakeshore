import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import RegistrationsManager from './admin/RegistrationsManager'
import UnitsManager from './admin/UnitsManager'
import GuestApprovals from './admin/GuestApprovals'
import WorkPermitsManager from './admin/WorkPermitsManager'
import AnnouncementsManager from './admin/AnnouncementsManager'
import MaintenanceManager from './admin/MaintenanceManager'
import BillingManager from './admin/BillingManager'

const TABS = [
  { key: 'registrations', label: 'Registrations' },
  { key: 'units', label: 'Units' },
  { key: 'guests', label: 'Guest Approvals' },
  { key: 'permits', label: 'Work Permits' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'billing', label: 'Billing' },
]

export default function AdminDashboard({ profile }) {
  const [tab, setTab] = useState('registrations')
  const [counts, setCounts] = useState({ registrations: 0, guests: 0, permits: 0 })

  async function loadCounts() {
    const [{ count: profilesPending }, { count: claimsPending }, { count: guestsPending }, { count: permitsPending }] =
      await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'owner').eq('approval_status', 'pending'),
        supabase.from('unit_claims').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('guests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('work_permits').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ])
    setCounts({
      registrations: (profilesPending || 0) + (claimsPending || 0),
      guests: guestsPending || 0,
      permits: permitsPending || 0,
    })
  }

  useEffect(() => {
    loadCounts()
    const interval = setInterval(loadCounts, 20000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    loadCounts()
  }, [tab])

  return (
    <div>
      <div className="view-header">
        <div className="eyebrow">Admin</div>
        <h1>Building Management</h1>
        <div className="subtext">Registrations, units, approvals, announcements, maintenance, and billing in one place</div>
      </div>

      <div className="subtabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
            {counts[t.key] > 0 && <span className="tab-badge">{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      {tab === 'registrations' && <RegistrationsManager />}
      {tab === 'units' && <UnitsManager />}
      {tab === 'guests' && <GuestApprovals profile={profile} />}
      {tab === 'permits' && <WorkPermitsManager profile={profile} />}
      {tab === 'announcements' && <AnnouncementsManager profile={profile} />}
      {tab === 'maintenance' && <MaintenanceManager profile={profile} />}
      {tab === 'billing' && <BillingManager />}
    </div>
  )
}