import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import GuestCheckPanel from '../components/GuestCheckPanel'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function FrontDesk({ profile }) {
  const [todayGuests, setTodayGuests] = useState([])
  const [permits, setPermits] = useState([])
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

  async function loadPermits() {
    const { data } = await supabase
      .from('work_permits')
      .select('*')
      .eq('status', 'approved')
      .gte('valid_to', todayStr())
      .order('valid_from', { ascending: true })
    setPermits(data || [])
  }

  useEffect(() => {
    loadToday()
    loadPermits()
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    setSearching(true)
    const timeout = setTimeout(() => runSearch(q), 300)
    return () => clearTimeout(timeout)
  }, [query])

  async function runSearch(q) {
    const { data } = await supabase
      .from('guests')
      .select('*, units!inner(unit_number)')
      .or(`guest_name.ilike.%${q}%,units.unit_number.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(20)
    setResults(data || [])
    setSearching(false)
  }

  async function checkInWorker(id) {
    await supabase
      .from('work_permits')
      .update({ checked_in_at: new Date().toISOString(), checked_in_by: profile.id })
      .eq('id', id)
    loadPermits()
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
        {todayGuests.length === 0 && <div className="empty">No guests expected today.</div>}
        {todayGuests.map((g) => (
          <GuestCheckPanel key={g.id} guest={g} unitLabel={g.units?.unit_number} onRefresh={loadToday} profile={profile} />
        ))}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2>Active Work Permits</h2>
        {permits.length === 0 && <div className="empty">No active work permits.</div>}
        {permits.map((p) => (
          <div className="list-item" key={p.id}>
            <div>
              <div className="title">{p.worker_names}</div>
              <div className="meta">
                {p.tower}, Unit {p.unit_number}
                {p.company ? ` · ${p.company}` : ''}
                {p.purpose ? ` · ${p.purpose}` : ''}
              </div>
              <div style={{ marginTop: 8 }}>
                {p.checked_in_at ? (
                  <span className="status-pill arrived">
                    <span className="dot"></span>
                    Checked in{' '}
                    {new Date(p.checked_in_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                ) : (
                  <button className="btn-small" onClick={() => checkInWorker(p.id)}>
                    Check in
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
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
        <GuestCheckPanel
          key={g.id}
          guest={g}
          unitLabel={g.units?.unit_number}
          onRefresh={() => runSearch(query.trim())}
          profile={profile}
        />
      ))}
    </div>
  )
}