import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Ticket from '../components/Ticket'

export default function OwnerDashboard({ profile }) {
  const [unit, setUnit] = useState(null)
  const [bills, setBills] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [guests, setGuests] = useState([])
  const [form, setForm] = useState({ guest_name: '', valid_from: '', valid_to: '', purpose: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  async function loadAll() {
    const { data: unitData } = await supabase
      .from('units')
      .select('*')
      .eq('owner_id', profile.id)
      .maybeSingle()
    setUnit(unitData)

    if (unitData) {
      const [{ data: billsData }, { data: guestsData }] = await Promise.all([
        supabase
          .from('hoa_bills')
          .select('*')
          .eq('unit_id', unitData.id)
          .order('due_date', { ascending: false }),
        supabase
          .from('guests')
          .select('*')
          .eq('unit_id', unitData.id)
          .order('created_at', { ascending: false }),
      ])
      setBills(billsData || [])
      setGuests(guestsData || [])
    }

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
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submitGuest(e) {
    e.preventDefault()
    setFormError('')
    if (!unit) {
      setFormError('No unit is linked to your account yet. Contact the admin.')
      return
    }
    if (!form.guest_name || !form.valid_from || !form.valid_to) {
      setFormError('Please fill in guest name and both dates.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.from('guests').insert({
      unit_id: unit.id,
      submitted_by: profile.id,
      guest_name: form.guest_name,
      valid_from: form.valid_from,
      valid_to: form.valid_to,
      purpose: form.purpose || null,
    })
    setSubmitting(false)
    if (error) {
      setFormError(error.message)
      return
    }
    setForm({ guest_name: '', valid_from: '', valid_to: '', purpose: '' })
    loadAll()
  }

  const latestBill = bills[0]

  return (
    <div>
      <div className="view-header">
        <div className="eyebrow">Owner Portal</div>
        <h1>Welcome back, {profile.full_name}</h1>
        <div className="subtext">
          {unit ? `Unit ${unit.unit_number}${unit.building ? ' · ' + unit.building : ''}` : 'No unit linked yet'}
        </div>
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
              <label>Guest name</label>
              <input
                type="text"
                placeholder="e.g. Maria Santos"
                value={form.guest_name}
                onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
              />
              <div className="two-col">
                <div>
                  <label>Check-in date</label>
                  <input
                    type="date"
                    value={form.valid_from}
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                  />
                </div>
                <div>
                  <label>Check-out date</label>
                  <input
                    type="date"
                    value={form.valid_to}
                    onChange={(e) => setForm({ ...form, valid_to: e.target.value })}
                  />
                </div>
              </div>
              <label>Purpose (optional)</label>
              <input
                type="text"
                placeholder="e.g. Family visit"
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              />
              {formError && <div className="error-text">{formError}</div>}
              <button className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit for approval'}
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
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2>Your Guest Submissions</h2>
        {guests.length ? (
          guests.map((g) => <Ticket key={g.id} guest={g} unitLabel={unit?.unit_number} />)
        ) : (
          <div className="empty">No guest submissions yet.</div>
        )}
      </div>
    </div>
  )
}