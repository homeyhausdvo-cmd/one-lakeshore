import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Ticket from '../components/Ticket'

const TOWERS = ['Tower 1', 'Tower 2', 'Tower 3', 'Tower 4']
const BILL_TYPES = [
  { value: 'hoa', label: 'HOA Dues' },
  { value: 'electric', label: 'Electric Bill' },
  { value: 'water', label: 'Water Bill' },
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function OwnerDashboard({ profile }) {
  const [activeTab, setActiveTab] = useState('dashboard')

  const [units, setUnits] = useState([])
  const [selectedUnitId, setSelectedUnitId] = useState(null)
  const [bills, setBills] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [guests, setGuests] = useState([])
  const [permits, setPermits] = useState([])

  const [guestForm, setGuestForm] = useState({
    guest_name: '',
    additional_names: '',
    contact_number: '',
    valid_from: '',
    checkin_time: '',
    valid_to: '',
    checkout_time: '',
    purpose: '',
  })
  const [guestSubmitting, setGuestSubmitting] = useState(false)
  const [guestError, setGuestError] = useState('')

  const [permitForm, setPermitForm] = useState({
    worker_names: '',
    company: '',
    purpose: '',
    valid_from: '',
    valid_to: '',
  })
  const [permitSubmitting, setPermitSubmitting] = useState(false)
  const [permitError, setPermitError] = useState('')

  const [showClaimForm, setShowClaimForm] = useState(false)
  const [claimForm, setClaimForm] = useState({ tower: 'Tower 1', unit_number: '', occupancy_type: 'owner_occupied' })
  const [claimSubmitting, setClaimSubmitting] = useState(false)
  const [claimError, setClaimError] = useState('')
  const [claimDone, setClaimDone] = useState(false)

  const [grants, setGrants] = useState([])
  const [grantForm, setGrantForm] = useState({ email: '', can_guests: true, can_permits: true, can_billing: false })
  const [grantSubmitting, setGrantSubmitting] = useState(false)
  const [grantError, setGrantError] = useState('')

  async function loadUnits() {
    const { data } = await supabase
      .from('units')
      .select('*')
      .eq('owner_id', profile.id)
      .order('unit_number')
    setUnits(data || [])
    if (data && data.length > 0 && !selectedUnitId) {
      setSelectedUnitId(data[0].id)
    }
  }

  async function loadUnitData(unitId) {
    if (!unitId) return
    const [{ data: billsData }, { data: guestsData }] = await Promise.all([
      supabase.from('hoa_bills').select('*').eq('unit_id', unitId).order('due_date', { ascending: false }),
      supabase.from('guests').select('*').eq('unit_id', unitId).order('created_at', { ascending: false }),
    ])
    setBills(billsData || [])
    setGuests(guestsData || [])
  }

  async function loadPermits() {
    const { data } = await supabase
      .from('work_permits')
      .select('*')
      .eq('submitted_by', profile.id)
      .order('created_at', { ascending: false })
    setPermits(data || [])
  }

  async function loadBuildingWide() {
    const [{ data: annData }, { data: maintData }] = await Promise.all([
      supabase
        .from('announcements')
        .select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('maintenance_schedule')
        .select('*')
        .gte('scheduled_date', new Date().toISOString().slice(0, 10))
        .order('scheduled_date', { ascending: true })
        .limit(5),
    ])
    setAnnouncements(annData || [])
    setMaintenance(maintData || [])
  }

  useEffect(() => {
    loadUnits()
    loadBuildingWide()
    loadPermits()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadGrants(unitId) {
    if (!unitId) return
    const { data } = await supabase
      .from('unit_manager_access')
      .select('*')
      .eq('unit_id', unitId)
      .order('created_at', { ascending: false })
    setGrants(data || [])
  }

  useEffect(() => {
    if (selectedUnitId) {
      loadUnitData(selectedUnitId)
      loadGrants(selectedUnitId)
    }
  }, [selectedUnitId])

  const selectedUnit = units.find((u) => u.id === selectedUnitId)

  const additionalNamesList = guestForm.additional_names
    .split('\n')
    .map((n) => n.trim())
    .filter(Boolean)
  const totalGuestCount = (guestForm.guest_name.trim() ? 1 : 0) + additionalNamesList.length

  const guestsToday = guests.filter((g) => g.valid_from === todayStr())

  async function submitGuest(e) {
    e.preventDefault()
    setGuestError('')
    if (!selectedUnitId) {
      setGuestError('No unit selected.')
      return
    }
    if (!guestForm.guest_name || !guestForm.valid_from || !guestForm.valid_to) {
      setGuestError('Please fill in primary guest name and both dates.')
      return
    }
    setGuestSubmitting(true)
    const { error } = await supabase.from('guests').insert({
      unit_id: selectedUnitId,
      submitted_by: profile.id,
      guest_name: guestForm.guest_name,
      additional_guest_names: additionalNamesList,
      contact_number: guestForm.contact_number || null,
      valid_from: guestForm.valid_from,
      checkin_time: guestForm.checkin_time || null,
      valid_to: guestForm.valid_to,
      checkout_time: guestForm.checkout_time || null,
      purpose: guestForm.purpose || null,
    })
    setGuestSubmitting(false)
    if (error) {
      setGuestError(error.message)
      return
    }
    setGuestForm({
      guest_name: '',
      additional_names: '',
      contact_number: '',
      valid_from: '',
      checkin_time: '',
      valid_to: '',
      checkout_time: '',
      purpose: '',
    })
    loadUnitData(selectedUnitId)
  }

  async function submitPermit(e) {
    e.preventDefault()
    setPermitError('')
    if (!selectedUnit) {
      setPermitError('No unit selected.')
      return
    }
    if (!permitForm.worker_names.trim() || !permitForm.valid_from || !permitForm.valid_to) {
      setPermitError('Please fill in worker name(s) and both dates.')
      return
    }
    setPermitSubmitting(true)
    const { error } = await supabase.from('work_permits').insert({
      submitted_by: profile.id,
      tower: selectedUnit.building,
      unit_number: selectedUnit.unit_number,
      worker_names: permitForm.worker_names.trim(),
      company: permitForm.company.trim() || null,
      purpose: permitForm.purpose.trim() || null,
      valid_from: permitForm.valid_from,
      valid_to: permitForm.valid_to,
    })
    setPermitSubmitting(false)
    if (error) {
      setPermitError(error.message)
      return
    }
    setPermitForm({ worker_names: '', company: '', purpose: '', valid_from: '', valid_to: '' })
    loadPermits()
  }

  async function submitClaim(e) {
    e.preventDefault()
    setClaimError('')
    if (!claimForm.unit_number.trim()) {
      setClaimError('Please enter the unit number.')
      return
    }
    setClaimSubmitting(true)
    const { error } = await supabase.from('unit_claims').insert({
      owner_id: profile.id,
      tower: claimForm.tower,
      unit_number: claimForm.unit_number.trim(),
      occupancy_type: claimForm.occupancy_type,
    })
    setClaimSubmitting(false)
    if (error) {
      setClaimError(error.message)
      return
    }
    setClaimForm({ tower: 'Tower 1', unit_number: '', occupancy_type: 'owner_occupied' })
    setClaimDone(true)
  }

  async function submitGrant(e) {
    e.preventDefault()
    setGrantError('')
    if (!grantForm.email.trim()) {
      setGrantError('Please enter an email address.')
      return
    }
    if (!selectedUnitId) {
      setGrantError('No unit selected.')
      return
    }
    setGrantSubmitting(true)
    const { error } = await supabase.from('unit_manager_access').insert({
      unit_id: selectedUnitId,
      manager_email: grantForm.email.trim().toLowerCase(),
      can_guests: grantForm.can_guests,
      can_permits: grantForm.can_permits,
      can_billing: grantForm.can_billing,
      invited_by: profile.id,
    })
    setGrantSubmitting(false)
    if (error) {
      setGrantError(error.message)
      return
    }
    setGrantForm({ email: '', can_guests: true, can_permits: true, can_billing: false })
    loadGrants(selectedUnitId)
  }

  async function revokeGrant(id) {
    if (!confirm('Revoke this manager\'s access to this unit?')) return
    await supabase.from('unit_manager_access').delete().eq('id', id)
    loadGrants(selectedUnitId)
  }

  if (units.length === 0) {
    return (
      <div>
        <div className="view-header">
          <div className="eyebrow">Owner Portal</div>
          <h1>Welcome back, {profile.full_name}</h1>
          <div className="subtext">No unit linked to your account yet. Contact the admin.</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="eyebrow">Owner Portal</div>
          <h1>Welcome back, {profile.full_name}</h1>
          {units.length > 1 ? (
            <div style={{ marginTop: 10 }}>
              <select
                style={{ width: 260 }}
                value={selectedUnitId || ''}
                onChange={(e) => setSelectedUnitId(e.target.value)}
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    Unit {u.unit_number}
                    {u.building ? ` · ${u.building}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="subtext">
              Unit {selectedUnit?.unit_number}
              {selectedUnit?.building ? ` · ${selectedUnit.building}` : ''}
            </div>
          )}
        </div>
        <button
          className="btn-small"
          onClick={() => {
            setShowClaimForm(!showClaimForm)
            setClaimDone(false)
          }}
        >
          + Register Another Unit
        </button>
      </div>

      {showClaimForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          {claimDone ? (
            <div>
              <div className="title" style={{ marginBottom: 6 }}>Request submitted</div>
              <div className="meta">
                Your admin will review and link this unit to your account. It'll appear in your unit
                switcher above once approved.
              </div>
              <button className="link-btn" style={{ marginTop: 10 }} onClick={() => setShowClaimForm(false)}>
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={submitClaim}>
              <h2>Register Another Unit You Own</h2>
              <div className="two-col">
                <div>
                  <label>Tower</label>
                  <select
                    value={claimForm.tower}
                    onChange={(e) => setClaimForm({ ...claimForm, tower: e.target.value })}
                  >
                    {TOWERS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Unit Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 14B"
                    value={claimForm.unit_number}
                    onChange={(e) => setClaimForm({ ...claimForm, unit_number: e.target.value })}
                  />
                </div>
              </div>
              <label>Occupancy Type</label>
              <select
                value={claimForm.occupancy_type}
                onChange={(e) => setClaimForm({ ...claimForm, occupancy_type: e.target.value })}
              >
                <option value="owner_occupied">Owner-occupied</option>
                <option value="long_term_tenant">Long-term tenant</option>
                <option value="str">STR (short-term rental)</option>
              </select>
              {claimError && <div className="error-text">{claimError}</div>}
              <button className="btn btn-primary" disabled={claimSubmitting}>
                {claimSubmitting ? 'Submitting…' : 'Submit for admin approval'}
              </button>
            </form>
          )}
        </div>
      )}

      <div className="subtabs">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
          Dashboard
        </button>
        <button className={activeTab === 'billing' ? 'active' : ''} onClick={() => setActiveTab('billing')}>
          Billing
        </button>
        <button className={activeTab === 'forms' ? 'active' : ''} onClick={() => setActiveTab('forms')}>
          Forms
        </button>
        <button className={activeTab === 'guestlist' ? 'active' : ''} onClick={() => setActiveTab('guestlist')}>
          Guest List
        </button>
        <button className={activeTab === 'access' ? 'active' : ''} onClick={() => setActiveTab('access')}>
          Access
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <div className="grid2">
          <div className="stack">
            <div className="card">
              <h2>Guests Checking In Today</h2>
              {guestsToday.length === 0 && <div className="empty">No guests expected today.</div>}
              {guestsToday.map((g) => (
                <Ticket key={g.id} guest={g} unitLabel={selectedUnit?.unit_number} />
              ))}
            </div>

            <div className="card">
              <h2>Your Work Permits</h2>
              {permits.length === 0 && <div className="empty">No permits submitted yet.</div>}
              {permits.map((p) => (
                <div className="list-item" key={p.id}>
                  <div>
                    <div className="title">
                      {p.worker_names}{' '}
                      <span className={`badge ${p.status === 'approved' ? 'paid' : p.status === 'rejected' ? 'overdue' : 'unpaid'}`}>
                        {p.status}
                      </span>
                    </div>
                    <div className="meta">
                      {p.tower}, Unit {p.unit_number} · {p.purpose}
                      <br />
                      {new Date(p.valid_from + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' → '}
                      {new Date(p.valid_to + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="stack">
            <div className="card">
              <h2>Announcements</h2>
              {announcements.length ? (
                announcements.map((a) => (
                  <div className="list-item" key={a.id}>
                    <div>
                      <div className="title">
                        {a.title}
                        {a.pinned && <span className="pin">PINNED</span>}
                      </div>
                      <div className="meta">{a.body}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty">No announcements yet.</div>
              )}
            </div>

            <div className="card">
              <h2>Maintenance Schedule</h2>
              {maintenance.length ? (
                maintenance.map((m) => (
                  <div className="list-item" key={m.id}>
                    <div>
                      <div className="title">{m.title}</div>
                      <div className="meta">
                        {m.area}
                        {m.scheduled_time ? `, ${m.scheduled_time}` : ''}
                      </div>
                    </div>
                    <div className="date-chip">
                      {new Date(m.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty">Nothing scheduled.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="stack">
          {BILL_TYPES.map((bt) => {
            const typeBills = bills.filter((b) => b.bill_type === bt.value)
            const latest = typeBills[0]
            return (
              <div className="card" key={bt.value}>
                <h2>{bt.label}</h2>
                {latest ? (
                  <>
                    <div className="dues-row">
                      <div className="dues-amount">₱{Number(latest.amount).toLocaleString()}</div>
                      <span className={`badge ${latest.status}`}>{latest.status}</span>
                    </div>
                    <div className="dues-meta">
                      For {latest.period_label} · Due{' '}
                      {new Date(latest.due_date + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                    {typeBills.length > 1 && (
                      <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                        {typeBills.slice(1).map((b) => (
                          <div className="list-item" key={b.id}>
                            <div>
                              <div className="title">{b.period_label}</div>
                              <div className="meta">
                                ₱{Number(b.amount).toLocaleString()} · due{' '}
                                {new Date(b.due_date + 'T00:00:00').toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </div>
                            </div>
                            <span className={`badge ${b.status}`}>{b.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="empty">No {bt.label.toLowerCase()} on record.</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'forms' && (
        <div className="grid2">
          <div className="card">
            <h2>Submit a Guest</h2>
            <form onSubmit={submitGuest}>
              <label>Primary Guest Name</label>
              <input
                type="text"
                placeholder="e.g. Maria Santos"
                value={guestForm.guest_name}
                onChange={(e) => setGuestForm({ ...guestForm, guest_name: e.target.value })}
              />

              <label>Additional Guest Names (optional, one per line)</label>
              <textarea
                rows={3}
                placeholder={'e.g.\nJuan Santos\nAna Santos'}
                value={guestForm.additional_names}
                onChange={(e) => setGuestForm({ ...guestForm, additional_names: e.target.value })}
              />
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                Total guests: {totalGuestCount || 0}
              </div>

              <label>Contact Number</label>
              <input
                type="tel"
                placeholder="e.g. 09171234567"
                value={guestForm.contact_number}
                onChange={(e) => setGuestForm({ ...guestForm, contact_number: e.target.value })}
              />

              <div className="two-col">
                <div>
                  <label>Check-in date</label>
                  <input
                    type="date"
                    value={guestForm.valid_from}
                    onChange={(e) => setGuestForm({ ...guestForm, valid_from: e.target.value })}
                  />
                </div>
                <div>
                  <label>Check-in time</label>
                  <input
                    type="time"
                    value={guestForm.checkin_time}
                    onChange={(e) => setGuestForm({ ...guestForm, checkin_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="two-col">
                <div>
                  <label>Check-out date</label>
                  <input
                    type="date"
                    value={guestForm.valid_to}
                    onChange={(e) => setGuestForm({ ...guestForm, valid_to: e.target.value })}
                  />
                </div>
                <div>
                  <label>Check-out time</label>
                  <input
                    type="time"
                    value={guestForm.checkout_time}
                    onChange={(e) => setGuestForm({ ...guestForm, checkout_time: e.target.value })}
                  />
                </div>
              </div>

              <label>Purpose (optional)</label>
              <input
                type="text"
                placeholder="e.g. Family visit"
                value={guestForm.purpose}
                onChange={(e) => setGuestForm({ ...guestForm, purpose: e.target.value })}
              />
              {guestError && <div className="error-text">{guestError}</div>}
              <button className="btn btn-primary" disabled={guestSubmitting}>
                {guestSubmitting ? 'Submitting…' : 'Submit for approval'}
              </button>
            </form>
          </div>

          <div className="card">
            <h2>Submit a Work Permit</h2>
            <form onSubmit={submitPermit}>
              <label>Worker Name(s)</label>
              <input
                type="text"
                placeholder="e.g. Juan Cruz, Pedro Reyes"
                value={permitForm.worker_names}
                onChange={(e) => setPermitForm({ ...permitForm, worker_names: e.target.value })}
              />
              <label>Company (optional)</label>
              <input
                type="text"
                placeholder="e.g. ABC Renovation Services"
                value={permitForm.company}
                onChange={(e) => setPermitForm({ ...permitForm, company: e.target.value })}
              />
              <label>Purpose of Work</label>
              <input
                type="text"
                placeholder="e.g. Bathroom renovation"
                value={permitForm.purpose}
                onChange={(e) => setPermitForm({ ...permitForm, purpose: e.target.value })}
              />
              <div className="two-col">
                <div>
                  <label>Valid From</label>
                  <input
                    type="date"
                    value={permitForm.valid_from}
                    onChange={(e) => setPermitForm({ ...permitForm, valid_from: e.target.value })}
                  />
                </div>
                <div>
                  <label>Valid To</label>
                  <input
                    type="date"
                    value={permitForm.valid_to}
                    onChange={(e) => setPermitForm({ ...permitForm, valid_to: e.target.value })}
                  />
                </div>
              </div>
              {permitError && <div className="error-text">{permitError}</div>}
              <button className="btn btn-primary" disabled={permitSubmitting}>
                {permitSubmitting ? 'Submitting…' : 'Submit for approval'}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'guestlist' && (
        <div className="card">
          <h2>
            Guest List {selectedUnit ? `— Unit ${selectedUnit.unit_number}` : ''}
          </h2>
          <div className="subtext" style={{ marginTop: -6, marginBottom: 16 }}>
            Full history — including check-in/out timestamps and any unregistered guest reports from front desk
          </div>
          {guests.length ? (
            guests.map((g) => <Ticket key={g.id} guest={g} unitLabel={selectedUnit?.unit_number} />)
          ) : (
            <div className="empty">No guest submissions yet.</div>
          )}
        </div>
      )}

      {activeTab === 'access' && (
        <div className="grid2">
          <div className="card">
            <h2>Invite a Manager {selectedUnit ? `— Unit ${selectedUnit.unit_number}` : ''}</h2>
            <div className="subtext" style={{ marginTop: -8, marginBottom: 14 }}>
              Grant someone access to this unit only — pick exactly what they can see and do
            </div>
            <form onSubmit={submitGrant}>
              <label>Manager's Email</label>
              <input
                type="email"
                placeholder="e.g. manager@example.com"
                value={grantForm.email}
                onChange={(e) => setGrantForm({ ...grantForm, email: e.target.value })}
              />
              <div className="checkbox-row">
                <input
                  type="checkbox"
                  id="can_guests"
                  checked={grantForm.can_guests}
                  onChange={(e) => setGrantForm({ ...grantForm, can_guests: e.target.checked })}
                />
                <label htmlFor="can_guests">Guest Form — submit & view guests for this unit</label>
              </div>
              <div className="checkbox-row">
                <input
                  type="checkbox"
                  id="can_permits"
                  checked={grantForm.can_permits}
                  onChange={(e) => setGrantForm({ ...grantForm, can_permits: e.target.checked })}
                />
                <label htmlFor="can_permits">Work Permit Form — submit & view permits for this unit</label>
              </div>
              <div className="checkbox-row">
                <input
                  type="checkbox"
                  id="can_billing"
                  checked={grantForm.can_billing}
                  onChange={(e) => setGrantForm({ ...grantForm, can_billing: e.target.checked })}
                />
                <label htmlFor="can_billing">Billing — view Statement of Account (HOA / Electric / Water)</label>
              </div>
              {grantError && <div className="error-text">{grantError}</div>}
              <button className="btn btn-primary" disabled={grantSubmitting}>
                {grantSubmitting ? 'Granting…' : 'Grant access'}
              </button>
            </form>
          </div>

          <div className="card">
            <h2>People With Access</h2>
            {grants.length === 0 && <div className="empty">No one else has access to this unit yet.</div>}
            {grants.map((g) => (
              <div className="list-item" key={g.id}>
                <div>
                  <div className="title">{g.manager_email}</div>
                  <div className="meta" style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {g.can_guests && <span className="occ-badge owner_occupied">Guest Form</span>}
                    {g.can_permits && <span className="occ-badge long_term_tenant">Work Permits</span>}
                    {g.can_billing && <span className="occ-badge str">Billing</span>}
                  </div>
                  <button className="link-btn danger" style={{ marginTop: 8 }} onClick={() => revokeGrant(g.id)}>
                    Revoke access
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
