import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

export default function AnnouncementsManager({ profile }) {
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ title: '', body: '', pinned: false })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setItems(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.title.trim() || !form.body.trim()) {
      setError('Please fill in a title and message.')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.from('announcements').insert({
      title: form.title.trim(),
      body: form.body.trim(),
      pinned: form.pinned,
      posted_by: profile.id,
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ title: '', body: '', pinned: false })
    load()
  }

  async function togglePin(item) {
    await supabase.from('announcements').update({ pinned: !item.pinned }).eq('id', item.id)
    load()
  }

  async function remove(id) {
    if (!confirm('Delete this announcement?')) return
    await supabase.from('announcements').delete().eq('id', id)
    load()
  }

  return (
    <div className="grid2">
      <div className="card">
        <h2>Post an Announcement</h2>
        <form onSubmit={handleSubmit}>
          <label>Title</label>
          <input
            type="text"
            placeholder="e.g. Water interruption — July 6"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <label>Message</label>
          <textarea
            rows={4}
            placeholder="Details residents need to know..."
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
          <div className="checkbox-row">
            <input
              type="checkbox"
              id="pinned"
              checked={form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
            />
            <label htmlFor="pinned">Pin to top of owner feed</label>
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Posting…' : 'Post announcement'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Posted Announcements</h2>
        {items.length === 0 && <div className="empty">Nothing posted yet.</div>}
        {items.map((a) => (
          <div className="list-item" key={a.id}>
            <div>
              <div className="title">
                {a.title}
                {a.pinned && <span className="pin">PINNED</span>}
              </div>
              <div className="meta">{a.body}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 14 }}>
                <button className="link-btn" onClick={() => togglePin(a)}>
                  {a.pinned ? 'Unpin' : 'Pin'}
                </button>
                <button className="link-btn danger" onClick={() => remove(a.id)}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}