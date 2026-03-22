import { useState } from 'react'
import { useToast } from '../../context/ToastContext'

const INITIAL = {
  firstName: 'Hung',
  lastName: 'Nguyen',
  dob: '2002-01-01',
  phone: '(555) 867-5309',
  email: 'hung.nguyen@email.com',
  preferredLanguage: 'vi',
  allergies: 'Penicillin',
  medications: 'Lisinopril 10mg daily',
  conditions: 'Hypertension (managed)',
  emergencyName: 'Carlos Garcia',
  emergencyPhone: '(555) 234-5678',
  emergencyRelation: 'Spouse',
}

const LANGUAGES = [
  { code: 'es', label: 'Spanish' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ne', label: 'Nepali' },
  { code: 'zh', label: 'Mandarin Chinese' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'fr', label: 'French' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ar', label: 'Arabic' },
]

export default function PatientsPage() {
  const { showToast } = useToast()
  const [form, setForm] = useState(INITIAL)
  const [editing, setEditing] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSave = (e) => {
    e.preventDefault()
    setEditing(false)
    showToast('Profile saved.')
  }

  const handleCancel = () => {
    setForm(INITIAL)
    setEditing(false)
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-surface">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-outline-variant/30 bg-surface-container px-8">
        <h1 className="text-xl font-bold tracking-tight text-primary">My info</h1>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/20"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Edit
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <form onSubmit={handleSave} className="mx-auto max-w-2xl space-y-8">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-container text-2xl font-black text-on-primary-container">
              {form.firstName[0]}{form.lastName[0]}
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface">{form.firstName} {form.lastName}</h2>
              <p className="text-sm text-outline">Patient — {LANGUAGES.find((l) => l.code === form.preferredLanguage)?.label || form.preferredLanguage}</p>
            </div>
          </div>

          <Section title="Personal information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="First name" value={form.firstName} onChange={set('firstName')} disabled={!editing} />
              <Field label="Last name" value={form.lastName} onChange={set('lastName')} disabled={!editing} />
              <Field label="Date of birth" type="date" value={form.dob} onChange={set('dob')} disabled={!editing} />
              <Field label="Phone" type="tel" value={form.phone} onChange={set('phone')} disabled={!editing} />
              <Field label="Email" type="email" value={form.email} onChange={set('email')} disabled={!editing} className="sm:col-span-2" />
              <div className={editing ? '' : 'sm:col-span-2'}>
                <label className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-wider text-outline">
                  Preferred language
                </label>
                <select
                  value={form.preferredLanguage}
                  onChange={set('preferredLanguage')}
                  disabled={!editing}
                  className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-70"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          <Section title="Medical information">
            <div className="space-y-4">
              <Field label="Known allergies" value={form.allergies} onChange={set('allergies')} disabled={!editing} />
              <Field label="Current medications" value={form.medications} onChange={set('medications')} disabled={!editing} />
              <Field label="Existing conditions" value={form.conditions} onChange={set('conditions')} disabled={!editing} />
            </div>
          </Section>

          <Section title="Emergency contact">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Name" value={form.emergencyName} onChange={set('emergencyName')} disabled={!editing} />
              <Field label="Phone" type="tel" value={form.emergencyPhone} onChange={set('emergencyPhone')} disabled={!editing} />
              <Field label="Relationship" value={form.emergencyRelation} onChange={set('emergencyRelation')} disabled={!editing} />
            </div>
          </Section>

          {editing && (
            <div className="flex items-center gap-3 border-t border-outline-variant/20 pt-6">
              <button
                type="submit"
                className="clinical-gradient rounded-lg px-6 py-3 text-sm font-bold text-white shadow-sm"
              >
                Save changes
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-outline-variant/40 px-6 py-3 text-sm font-bold text-on-surface transition hover:bg-surface-container-high"
              >
                Cancel
              </button>
            </div>
          )}
        </form>
      </div>
    </main>
  )
}

function Section({ title, children }) {
  return (
    <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-outline">{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, className = '', ...props }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-wider text-outline">
        {label}
      </label>
      <input
        className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-70"
        {...props}
      />
    </div>
  )
}
