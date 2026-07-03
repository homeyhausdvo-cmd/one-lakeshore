import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Ticket from '../components/Ticket'

export default function OwnerDashboard({ profile }) {
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

  useEffect(() => {
    if (selectedUnitId) loadUnitData(selectedUnitId)
  }, [selectedUnitId])

  const selectedUnit = units.find((u) => u.id === selectedUnitId)
  const latestBill = bills[0]

  const additionalNamesList = guestForm.additional_names
    .split('\n')
    .map((n) => n.trim())
    .filter(Boolean)
  const totalGuestCount = (guestForm.guest_name.trim() ? 1 : 0) + additionalNamesList.length

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
      <div className="view-header">
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

      <div className="grid2">
        <div className="stack">
          <div className="card">
            <h2>HOA Dues</h2>
            {latestBill ? (
              <>
                <div className="dues-row">
                  <div className="dues-amount">₱{Number(latestBill.amount).toLocaleString()}</div>
                  <span className={`badge ${latestBill.status}`}>{latestBill.status}</span>
                </div>
                <div className="dues-meta">
                  For {latestBill.period_label} · Due{' '}
                  {new Date(latestBill.due_date + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </>
            ) : (
              <div className="empty">No bills on record.</div>
            )}
          </div>

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
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2>
          Guest Submissions {selectedUnit ? `— Unit ${selectedUnit.unit_number}` : ''}
        </h2>
        {guests.length ? (
          guests.map((g) => <Ticket key={g.id} guest={g} unitLabel={selectedUnit?.unit_number} />)
        ) : (
          <div className="empty">No guest submissions yet.</div>
        )}
      </div>
    </div>
  )
}