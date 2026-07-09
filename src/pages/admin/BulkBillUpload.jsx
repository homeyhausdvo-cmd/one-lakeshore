import { useState } from 'react'
import { supabase } from '../../supabaseClient'

const TYPE_LABELS = { electric: 'Electric Bill', water: 'Water Bill', hoa: 'HOA Dues' }

function parseFilename(filename) {
  const base = filename.replace(/\.pdf$/i, '')
  const match = base.match(/^(.+?)[_\-](electric|water|hoa)$/i)
  if (!match) return null
  return { unit_number: match[1].trim(), bill_type: match[2].toLowerCase() }
}

export default function BulkBillUpload({ onClose, onUploaded }) {
  const [rows, setRows] = useState([])
  const [uploading, setUploading] = useState(false)
  const [summary, setSummary] = useState('')

  async function handleFiles(fileList) {
    const { data: units } = await supabase.from('units').select('id, unit_number')

    const parsed = Array.from(fileList).map((file) => {
      const parsedName = parseFilename(file.name)
      const unit = parsedName
        ? units.find((u) => u.unit_number.toLowerCase() === parsedName.unit_number.toLowerCase())
        : null
      return {
        file,
        filename: file.name,
        unit_number: parsedName?.unit_number || '(unrecognized)',
        bill_type: parsedName?.bill_type || null,
        unit_id: unit?.id || null,
        period_label: '',
        amount: '',
        due_date: '',
        matched: !!unit && !!parsedName,
      }
    })
    setRows(parsed)
    setSummary('')
  }

  function updateRow(idx, field, value) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))
  }

  async function uploadAll() {
    setUploading(true)
    let success = 0, skipped = 0, failed = 0

    for (const row of rows) {
      if (!row.matched || !row.period_label.trim() || !row.amount || !row.due_date) {
        skipped++
        continue
      }
      const path = `${row.unit_id}/${row.bill_type}/${Date.now()}_${row.filename}`
      const { error: upErr } = await supabase.storage.from('bills').upload(path, row.file)
      if (upErr) {
        failed++
        continue
      }
      const { error: insErr } = await supabase.from('hoa_bills').insert({
        unit_id: row.unit_id,
        bill_type: row.bill_type,
        period_label: row.period_label.trim(),
        amount: Number(row.amount),
        due_date: row.due_date,
        pdf_path: path,
      })
      if (insErr) {
        failed++
      } else {
        success++
      }
    }

    setUploading(false)
    setSummary(`${success} uploaded · ${skipped} skipped (incomplete) · ${failed} failed`)
    if (success > 0) onUploaded()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" style={{ width: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-box-header">
          <h2 style={{ margin: 0 }}>Bulk Upload Bills (PDF)</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="subtext" style={{ marginBottom: 14 }}>
          Name files like <strong>6P_Electric.pdf</strong>, <strong>9P_Water.pdf</strong>, or{' '}
          <strong>9P_HOA.pdf</strong> — the unit and bill type are detected automatically.
        </div>

        <input
          type="file"
          accept="application/pdf"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          style={{ marginBottom: 16 }}
        />

        {rows.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table className="mini-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Unit</th>
                  <th>Type</th>
                  <th>Period</th>
                  <th>Amount</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 11.5 }}>{r.filename}</td>
                    <td>
                      {r.matched ? (
                        <span style={{ color: 'var(--green)', fontWeight: 600 }}>{r.unit_number}</span>
                      ) : (
                        <span style={{ color: 'var(--red)', fontWeight: 600 }}>{r.unit_number}</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>{r.bill_type ? TYPE_LABELS[r.bill_type] : '—'}</td>
                    <td>
                      <input
                        type="text"
                        placeholder="July 2026"
                        value={r.period_label}
                        onChange={(e) => updateRow(i, 'period_label', e.target.value)}
                        style={{ width: 110, padding: '5px 7px', fontSize: 12 }}
                        disabled={!r.matched}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        placeholder="4500"
                        value={r.amount}
                        onChange={(e) => updateRow(i, 'amount', e.target.value)}
                        style={{ width: 90, padding: '5px 7px', fontSize: 12 }}
                        disabled={!r.matched}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={r.due_date}
                        onChange={(e) => updateRow(i, 'due_date', e.target.value)}
                        style={{ width: 140, padding: '5px 7px', fontSize: 12 }}
                        disabled={!r.matched}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {summary && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-soft)' }}>{summary}</div>}

        {rows.length > 0 && (
          <button className="btn btn-primary" disabled={uploading} onClick={uploadAll} style={{ width: '100%' }}>
            {uploading ? 'Uploading…' : `Upload ${rows.filter((r) => r.matched).length} matched bill(s)`}
          </button>
        )}
      </div>
    </div>
  )
}
