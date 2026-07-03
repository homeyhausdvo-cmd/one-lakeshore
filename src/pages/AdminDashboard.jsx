import { useState } from 'react'
import GuestApprovals from './admin/GuestApprovals'
import AnnouncementsManager from './admin/AnnouncementsManager'
import MaintenanceManager from './admin/MaintenanceManager'
import BillingManager from './admin/BillingManager'

const TABS = [
  { key: 'guests', label: 'Guest Approvals' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'billing', label: 'Billing' },
]

export default function AdminDashboard({ profile }) {
  const [tab, setTab] = useState('guests')

  return (
    <div>
      <div className="view-header">
        <div className="eyebrow">Admin</div>
        <h1>Building Management</h1>
        <div className="subtext">Approvals, announcements, maintenance, and billing in one place</div>
      </div>

      <div className="subtabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'guests' && <GuestApprovals profile={profile} />}
      {tab === 'announcements' && <AnnouncementsManager profile={profile} />}
      {tab === 'maintenance' && <MaintenanceManager profile={profile} />}
      {tab === 'billing' && <BillingManager />}
    </div>
  )
}