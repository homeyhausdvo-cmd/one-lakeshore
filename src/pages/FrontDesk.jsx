import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Ticket from '../components/Ticket'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function FrontDesk({ profile }) {
  const [todayGuests, setTodayGuests] = useState([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  async function loadToday() {
    const { data } = await supabase
      .from('guests')
      .select('*, units(unit_number)')
      .eq('valid_from', todayStr())
      .order('created_at', { ascending: true })
    setTodayGuests(data || [])
  }

  useEffect(() => {
    loadToday()
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    setSearching(true)
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('guests')
        .select('*, units!inner(unit_number)')
        .or(`guest_name.ilike.%${q}%,units.unit_number.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(20)
      setResults(data || [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  async function checkIn(id) {
    await supabase
      .from('guests')
      .update({ checked_in_at: new Date().toISOString(), checked_in_by: profile.id })
      .eq('id', id)
    loadToday()
    setResults((prev) =>
      prev.map((g) =>
        g.id === id ? { ...g, checked_in_at: new Date().toISOString(), checked_in_by: profile.id } : g
      )
    )
  }

  return (
    <div>
      <div className="view-header">
        <div className="eyebrow">Front Desk</div>
        <h1>Guest Check-in Lookup</h1>
        <div className="subtext">Search by unit number or guest name</div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2>
          Today's Check-ins{' '}
          <span
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontWeight: 500,
              fontSize: 12,
              color: 'var(--ink-soft)',
              textTransform: 'none',
              letterSpacing: 0,
            }}
          >
            —{' '}
            {new Date().toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </h2>
        <div className="checkin-table">
          <div className="checkin-row checkin-head">
            <div>Unit</div>
            <div>Guest</div>
            <div>Expected</div>
            <div>Status</div>
            <div></div>
          </div>
          {todayGuests.length === 0 && <div className="empty">No guests expected today.</div>}
          {todayGuests.map((g) => (
            <div className="checkin-row" key={g.id}>
              <div className="unit-code">{g.units?.unit_number || '—'}</div>
              <div className="guest">{g.guest_name}</div>
              <div className="time">Today</div>
              <div>
                {g.status !== 'approved' ? (
                  <span className="status-pill notapproved">
                    <span className="dot"></span>
                    {g.status === 'pending' ? 'Awaiting approval' : 'Rejected'}
                  </span>
                ) : g.checked_in_at ? (
                  <span className="status-pill arrived">
                    <span className="dot"></span>
                    Checked in{' '}
                    {new Date(g.checked_in_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                ) : (
                  <span className="status-pill waiting">
                    <span className="dot"></span>
                    Not yet
                  </span>
                )}
              </div>
              <div>
                {g.status === 'approved' && !g.checked_in_at && (
                  <button className="btn-small" onClick={() => checkIn(g.id)}>
                    Check in
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="view-header" style={{ marginBottom: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 2 }}>
          All guests
        </div>
        <div className="subtext" style={{ marginTop: 0 }}>
          Search by unit number or guest name
        </div>
      </div>
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search unit number or guest name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!query.trim() && <div className="empty">Start typing a unit number or guest name to search.</div>}
      {query.trim() && searching && <div className="empty">Searching…</div>}
      {query.trim() && !searching && results.length === 0 && (
        <div className="empty">No matching guest or unit found.</div>
      )}
      {results.map((g) => (
        <Ticket
          key={g.id}
          guest={g}
          unitLabel={g.units?.unit_number}
          checkinAction
          onCheckIn={checkIn}
        />
      ))}
    </div>
  )
}