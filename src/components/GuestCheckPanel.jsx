import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function GuestCheckPanel({ guest, unitLabel, onRefresh, profile }) {
  const [verifying, setVerifying] = useState(false)
  const [unexpectedInput, setUnexpectedInput] = useState('')
  const [busy, setBusy] = useState(false)

  const allNames = [guest.guest_name, ...(guest.additional_guest_names || [])].filter(Boolean)

  const fmtDate = (d) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const fmtTs = (ts) =>
    new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  async function confirmCheckIn() {
    setBusy(true)
    const extraNames = unexpectedInput
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
    await supabase
      .from('guests')
      .update({
        checked_in_at: new Date().toISOString(),
        checked_in_by: profile?.id,
        unwanted_guests: extraNames,
      })
      .eq('id', guest.id)
    setBusy(false)
    setVerifying(false)
    setUnexpectedInput('')
    onRefresh()
  }

  async function confirmCheckOut() {
    setBusy(true)
    await supabase
      .from('guests')
      .update({ checked_out_at: new Date().toISOString(), checked_out_by: profile?.id })
      .eq('id', guest.id)
    setBusy(false)
    onRefresh()
  }

  return (
    <div className="ticket" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex' }}>
        <div className="ticket-main">
          <div className="guest-name">{guest.guest_name}</div>
          <div className="unit-tag">UNIT {unitLabel}</div>
          <div className="dates">
            {fmtDate(guest.valid_from)}
            {guest.checkin_time ? ` ${guest.checkin_time}` : ''}
            {' → '}
            {fmtDate(guest.valid_to)}
            {guest.checkout_time ? ` ${guest.checkout_time}` : ''}
            {guest.purpose ? ` · ${guest.purpose}` : ''}
          </div>
          {allNames.length > 1 && (
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 6 }}>
              Expected guests ({allNames.length}): {allNames.join(', ')}
            </div>
          )}
          {guest.contact_number && (
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
              Contact: {guest.contact_number}
            </div>
          )}
        </div>
        <div className="ticket-divider"></div>
        <div className="ticket-status">
          <div className={`status-stamp ${guest.status}`}>
            {guest.status === 'pending' ? 'Pending' : guest.status === 'approved' ? 'Approved' : 'Rejected'}
          </div>

          {guest.status === 'approved' && !guest.checked_in_at && !verifying && (
            <button className="btn-small" onClick={() => setVerifying(true)}>
              Verify & Check in
            </button>
          )}

          {guest.status === 'approved' && guest.checked_in_at && !guest.checked_out_at && (
            <button className="btn-small" onClick={confirmCheckOut} disabled={busy}>
              {busy ? 'Checking out…' : 'Check out'}
            </button>
          )}

          {guest.checked_in_at && (
            <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, textAlign: 'center' }}>
              ✓ In: {fmtTs(guest.checked_in_at)}
            </div>
          )}
          {guest.checked_out_at && (
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', textAlign: 'center' }}>
              Out: {fmtTs(guest.checked_out_at)}
            </div>
          )}
        </div>
      </div>

      {verifying && (
        <div style={{ padding: '16px 18px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8 }}>
            Confirm the names above match ID / actual arrivals. If there are extra people not on the list,
            enter their names below (comma separated) before checking in.
          </div>
          <input
            type="text"
            placeholder="e.g. Extra Guest One, Extra Guest Two"
            value={unexpectedInput}
            onChange={(e) => setUnexpectedInput(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button className="btn btn-primary" style={{ marginTop: 0 }} onClick={confirmCheckIn} disabled={busy}>
              {busy ? 'Checking in…' : 'Confirm Check-in'}
            </button>
            <button className="link-btn" onClick={() => setVerifying(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {(guest.unwanted_guests || []).length > 0 && (
        <div
          style={{
            margin: '0 18px 16px',
            padding: '6px 10px',
            background: 'var(--red-light)',
            color: 'var(--red)',
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          ⚠ Unexpected guest(s) reported: {guest.unwanted_guests.join(', ')}
        </div>
      )}
    </div>
  )
}