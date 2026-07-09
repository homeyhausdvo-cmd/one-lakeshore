import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Ticket from '../components/Ticket'

export default function ManagerDashboard({ profile }) {
  const [grants, setGrants] = useState([])
  const [selectedGrantId, setSelectedGrantId] = useState(null)
  const [bills, setBills] = useState([])
  const [guests, setGuests] = useState([])

  const [guestForm, setGuestForm] = useState({
    guest_name: '', additional_names: '', contact_number: '',
    valid_from: '', checkin_time: '', valid_to: '', checkout_time: '', purpose: '',
  })
  const [guestSubmitting, setGuestSubmitting] = useState(false)
  const [guestError, setGuestError] = useState('')

  const [permitForm, setPermitForm] = useState({ worker_names: '', company: '', purpose: '', valid_from: '', valid_to: '' })
  const [permitSubmitting, setPermitSubmitting] = useState(false)
  const [permitError, setPermitError] = useState('')
  const [permits, setPermits] = useState([])

  async function loadGrants() {
    const { data } = await supabase
      .from('unit_manager_access')
      .select('*, units(id, unit_number, building)')
      .eq('manager_email', profile.email.toLowerCase())
      .order('created_at', { ascending: false })
    setGrants(data || [])
    if (data && data.length > 0 && !selectedGrantId) {
      setSelectedGrantId(data[0].id)
    }
  }

  async function loadUnitData(grant) {
    if (!grant) return
    if (grant.can_guests) {
      const { data } = await supabase
        .from('guests')
        .select('*')
        .eq('unit_id', grant.unit_id)
        .order('created_at', { ascending: false })
      setGuests(data || [])
    } else {
      setGuests([])
    }
    if (grant.can_billing) {
      const { data } = await supabase
        .from('hoa_bills')
        .select('*')
        .eq('unit_id', grant.unit_id)
        .order('due_date', { ascending: false })
      setBills(data || [])
    } else {
      setBills([])
    }
  }

  async function loadPermits() {
    const { data } = await supabase
      .from('work_permits')
      .select('*')
      .eq('submitted_by', profile.id)
      .order('created_at', { ascending: false })
    setPermits(data || [])
  }

  useEffect(() => {
    loadGrants()
    loadPermits()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedGrant = grants.find((g) => g.id === selectedGrantId)

  useEffect(() => {
    if (selectedGrant) loadUnitData(selectedGrant)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGrantId])

  const additionalNamesList = guestForm.additional_names.split('\n').map((n) => n.trim()).filter(Boolean)
  const totalGuestCount = (guestForm.guest_name.trim() ? 1 : 0) + additionalNamesList.length

  async function submitGuest(e) {
    e.preventDefault()
    setGuestError('')
    if (!selectedGrant) return
    if (!guestForm.guest_name || !guestForm.valid_from || !guestForm.valid_to) {
      setGuestError('Please fill in primary guest name and both dates.')
      return
    }
    setGuestSubmitting(true)
    const { error } = await supabase.from('guests').insert({
      unit_id: selectedGrant.unit_id,
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
    setGuestForm({ guest_name: '', additional_names: '', contact_number: '', valid_from: '', checkin_time: '', valid_to: '', checkout_time: '', purpose: '' })
    loadUnitData(selectedGrant)
  }

  async function submitPermit(e) {
    e.preventDefault()
    setPermitError('')
    if (!selectedGrant) return
    if (!permitForm.worker_names.trim() || !permitForm.valid_from || !permitForm.valid_to) {
      setPermitError('Please fill in worker name(s) and both dates.')
      return
    }
    setPermitSubmitting(true)
    const { error } = await supabase.from('work_permits').insert({
      submitted_by: profile.id,
      tower: selectedGrant.units.building,
      unit_number: selectedGrant.units.unit_number,
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

  if (grants.length === 0) {
    return (
      <div>
        <div className="view-header">
          <div className="eyebrow">Manager Portal</div>
          <h1>Welcome, {profile.full_name}</h1>
          <div className="subtext">
            No units have been shared with you yet. Ask a unit owner to grant you access using this
            email: <strong>{profile.email}</strong>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="view-header">
        <div className="eyebrow">Manager Portal</div>
        <h1>Welcome, {profile.full_name}</h1>
        <div style={{ marginTop: 10 }}>
          <select style={{ width: 300 }} value={selectedGrantId || ''} onChange={(e) => setSelectedGrantId(e.target.value)}>
            {grants.map((g) => (
              <option key={g.id} value={g.id}>
                Unit {g.units?.unit_number} · {g.units?.building}
              </option>
            ))}
          </select>
        </div>
        {selectedGrant && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {selectedGrant.can_guests && <span className="occ-badge owner_occupied">Guest Form</span>}
            {selectedGrant.can_permits && <span className="occ-badge long_term_tenant">Work Permits</span>}
            {selectedGrant.can_billing && <span className="occ-badge str">Billing</span>}
          </div>
        )}
      </div>

      <div className="grid2">
        <div className="stack">
          {selectedGrant?.can_guests && (
            <div className="card">
              <h2>Submit a Guest</h2>
              <form onSubmit={submitGuest}>
                <label>Primary Guest Name</label>
                <input type="text" placeholder="e.g. Maria Santos" value={guestForm.guest_name} onChange={(e) => setGuestForm({ ...guestForm, guest_name: e.target.value })} />
                <label>Additional Guest Names (optional, one per line)</label>
                <textarea rows={3} value={guestForm.additional_names} onChange={(e) => setGuestForm({ ...guestForm, additional_names: e.target.value })} />
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>Total guests: {totalGuestCount || 0}</div>
                <label>Contact Number</label>
                <input type="tel" placeholder="e.g. 09171234567" value={guestForm.contact_number} onChange={(e) => setGuestForm({ ...guestForm, contact_number: e.target.value })} />
                <div className="two-col">
                  <div>
                    <label>Check-in date</label>
                    <input type="date" value={guestForm.valid_from} onChange={(e) => setGuestForm({ ...guestForm, valid_from: e.target.value })} />
                  </div>
                  <div>
                    <label>Check-in time</label>
                    <input type="time" value={guestForm.checkin_time} onChange={(e) => setGuestForm({ ...guestForm, checkin_time: e.target.value })} />
                  </div>
                </div>
                <div className="two-col">
                  <div>
                    <label>Check-out date</label>
                    <input type="date" value={guestForm.valid_to} onChange={(e) => setGuestForm({ ...guestForm, valid_to: e.target.value })} />
                  </div>
                  <div>
                    <label>Check-out time</label>
                    <input type="time" value={guestForm.checkout_time} onChange={(e) => setGuestForm({ ...guestForm, checkout_time: e.target.value })} />
                  </div>
                </div>
                <label>Purpose (optional)</label>
                <input type="text" placeholder="e.g. Family visit" value={guestForm.purpose} onChange={(e) => setGuestForm({ ...guestForm, purpose: e.target.value })} />
                {guestError && <div className="error-text">{guestError}</div>}
                <button className="btn btn-primary" disabled={guestSubmitting}>{guestSubmitting ? 'Submitting…' : 'Submit for approval'}</button>
              </form>
            </div>
          )}

          {selectedGrant?.can_permits && (
            <div className="card">
              <h2>Submit a Work Permit</h2>
              <form onSubmit={submitPermit}>
                <label>Worker Name(s)</label>
                <input type="text" placeholder="e.g. Juan Cruz, Pedro Reyes" value={permitForm.worker_names} onChange={(e) => setPermitForm({ ...permitForm, worker_names: e.target.value })} />
                <label>Company (optional)</label>
                <input type="text" placeholder="e.g. ABC Renovation Services" value={permitForm.company} onChange={(e) => setPermitForm({ ...permitForm, company: e.target.value })} />
                <label>Purpose of Work</label>
                <input type="text" placeholder="e.g. Bathroom renovation" value={permitForm.purpose} onChange={(e) => setPermitForm({ ...permitForm, purpose: e.target.value })} />
                <div className="two-col">
                  <div>
                    <label>Valid From</label>
                    <input type="date" value={permitForm.valid_from} onChange={(e) => setPermitForm({ ...permitForm, valid_from: e.target.value })} />
                  </div>
                  <div>
                    <label>Valid To</label>
                    <input type="date" value={permitForm.valid_to} onChange={(e) => setPermitForm({ ...permitForm, valid_to: e.target.value })} />
                  </div>
                </div>
                {permitError && <div className="error-text">{permitError}</div>}
                <button className="btn btn-primary" disabled={permitSubmitting}>{permitSubmitting ? 'Submitting…' : 'Submit for approval'}</button>
              </form>
            </div>
          )}

          {!selectedGrant?.can_guests && !selectedGrant?.can_permits && (
            <div className="card">
              <div className="empty">The owner hasn't granted form access for this unit — you can only view what's shared below.</div>
            </div>
          )}
        </div>

        <div className="stack">
          {selectedGrant?.can_billing && (
            <div className="card">
              <h2>Statement of Account</h2>
              {bills.length === 0 && <div className="empty">No bills on record.</div>}
              {bills.map((b) => (
                <div className="list-item" key={b.id}>
                  <div>
                    <div className="title">{b.period_label} ({b.bill_type})</div>
                    <div className="meta">₱{Number(b.amount).toLocaleString()} · due {new Date(b.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  </div>
                  <span className={`badge ${b.status}`}>{b.status}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <h2>Your Work Permits</h2>
            {permits.filter((p) => selectedGrant && p.unit_number === selectedGrant.units?.unit_number).length === 0 ? (
              <div className="empty">No permits submitted for this unit yet.</div>
            ) : (
              permits
                .filter((p) => selectedGrant && p.unit_number === selectedGrant.units?.unit_number)
                .map((p) => (
                  <div className="list-item" key={p.id}>
                    <div>
                      <div className="title">
                        {p.worker_names}{' '}
                        <span className={`badge ${p.status === 'approved' ? 'paid' : p.status === 'rejected' ? 'overdue' : 'unpaid'}`}>{p.status}</span>
                      </div>
                      <div className="meta">{p.purpose}</div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {selectedGrant?.can_guests && (
        <div className="card" style={{ marginTop: 20 }}>
          <h2>Guest Submissions — Unit {selectedGrant.units?.unit_number}</h2>
          {guests.length ? (
            guests.map((g) => <Ticket key={g.id} guest={g} unitLabel={selectedGrant.units?.unit_number} />)
          ) : (
            <div className="empty">No guest submissions yet.</div>
          )}
        </div>
      )}
    </div>
  )
}