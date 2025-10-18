'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'

export type SantaHistoryItem = {
  text: string
  createdAtDate: Date | null
}

export type SantaGiftResult = {
  title: string
  image: string | null
  url: string | null
  retailer: 'amazon' | 'walmart' | 'ai'
  hasPrice: boolean
}

type Props = {
  lastAffirmation: string | null
  lastAffirmationAt: Date | null
  history: SantaHistoryItem[]
  // Interaction props
  mode: 'gifts' | 'deeds'
  onModeChange: (m: 'gifts' | 'deeds') => void
  noteText: string
  onChangeNote: (v: string) => void
  onSubmitGifts: (text: string) => void
  onSubmitDeed: (text: string) => void
  searching: boolean
  reading: boolean
  giftResults: SantaGiftResult[] | null
  onAddGift: (item: SantaGiftResult) => void
  toast?: string
  undoAvailable?: boolean
  onUndo?: () => void
  canSubmit?: boolean
}

export default function SantaChatCard({ lastAffirmation, lastAffirmationAt, history, mode, onModeChange, noteText, onChangeNote, onSubmitGifts, onSubmitDeed, searching, reading, giftResults, onAddGift, toast, undoAvailable, onUndo, canSubmit = true }: Props) {
  const [speaking, setSpeaking] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [emptyHint, setEmptyHint] = useState<string | null>(null)
  const [preparingAudio, setPreparingAudio] = useState(false)
  const [speakError, setSpeakError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [useDeep, setUseDeep] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    const v = localStorage.getItem('sh_tts_deep')
    return v == null ? true : v === 'true'
  })

  const canSpeechSynthesis = typeof window !== 'undefined' && 'speechSynthesis' in window

  const stopAll = () => {
    // Stop HTMLAudio playback
    try {
      const a = audioRef.current
      if (a && !a.paused) {
        a.pause()
        a.currentTime = 0
      }
    } catch {}
    // Stop speech synthesis
    try { if (canSpeechSynthesis) window.speechSynthesis.cancel() } catch {}
    setSpeaking(false)
    setPreparingAudio(false)
  }

  const pickVoice = (preferName?: string) => {
    if (!canSpeechSynthesis) return undefined
    const voices = window.speechSynthesis.getVoices()
    if (!voices || voices.length === 0) return undefined
    if (preferName) {
      const found = voices.find(v => v.name === preferName)
      if (found) return found
    }
    // Prefer en-US
    const en = voices.find(v => /en[-_]?US/i.test(v.lang))
    return en || voices[0]
  }

  const speakWithSynthesis = (text: string) => {
    if (!canSpeechSynthesis) throw new Error('Speech synthesis unsupported')
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 0.95
    u.pitch = 0.9
    u.volume = 1
    const prefer = typeof window !== 'undefined' ? localStorage.getItem('sh_voice') || undefined : undefined
    const v = pickVoice(prefer || undefined)
    if (v) u.voice = v
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(u)
  }

  const playWithFallback = async (text: string) => {
    setSpeakError(null)
    stopAll()
    setPreparingAudio(true)
    try {
      const endpoint = useDeep ? '/api/santa-readaloud-deep' : '/api/santa-readaloud'
      const body = useDeep ? { text, semitones: 3 } : { text }
      let res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!res.ok) {
        // Try standard on fail
        res = await fetch('/api/santa-readaloud', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text })
        })
      }
      if (!res.ok) throw new Error('tts-failed')
      const json = await res.json() as { ok?: boolean; dataUrl?: string }
      if (!json.ok || !json.dataUrl) throw new Error('tts-invalid')
      const a = audioRef.current || new Audio()
      if (!audioRef.current) audioRef.current = a
      a.src = json.dataUrl
      a.onended = () => setSpeaking(false)
      await a.play()
      setSpeaking(true)
    } catch {
      try {
        speakWithSynthesis(text)
      } catch {
        setSpeakError("We couldn't read the message aloud. Please try again.")
      }
    } finally {
      setPreparingAudio(false)
    }
  }

  useEffect(() => {
    return () => {
      stopAll()
    }
  }, [])

  useEffect(() => {
    try { localStorage.setItem('sh_tts_deep', useDeep ? 'true' : 'false') } catch {}
  }, [useDeep])

  const formatUpdatedAt = (d: Date) =>
    d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  const handleSubmit = () => {
    const text = noteText.trim()
    if (!text) {
      setEmptyHint('Please write your note first.')
      return
    }
    setEmptyHint(null)
    if (mode === 'gifts') onSubmitGifts(text)
    else onSubmitDeed(text)
  }

  const canSend = useMemo(() => noteText.trim().length > 0 && !!canSubmit, [noteText, canSubmit])

  return (
    <div>
      <div className="santa-chat">
        <div className="santa-avatar" aria-hidden="true">🎅</div>
        <div className="santa-bubble" aria-live="polite" aria-label="Santa’s message">
          {lastAffirmation ? (
            <p className="bubble-text" title={lastAffirmation}>{lastAffirmation}</p>
          ) : (
            <p className="bubble-text meter-text">Santa will leave a message here after your next note.</p>
          )}
          <div className="bubble-meta">
            {lastAffirmationAt ? (
              <>Updated: {formatUpdatedAt(lastAffirmationAt)}</>
            ) : (
              <>Awaiting your note…</>
            )}
          </div>
        </div>
        <div className="chat-controls">
          {!!lastAffirmation && (
            <>
              <button
                type="button"
                className="chip"
                aria-label={'Read Santa’s message aloud'}
                onClick={() => lastAffirmation && playWithFallback(lastAffirmation)}
                disabled={speaking || preparingAudio}
              >{preparingAudio ? 'Preparing audio…' : 'Read aloud'}</button>
              {speaking && (
                <button
                  type="button"
                  className="chip ghost"
                  aria-label={'Stop reading'}
                  onClick={stopAll}
                >Stop</button>
              )}
            </>
          )}
          <button
            type="button"
            className="chip"
            aria-expanded={showHistory}
            aria-controls="santa-history"
            onClick={() => setShowHistory(v => !v)}
          >{showHistory ? 'Hide history' : 'Show history'}</button>
        </div>
        {speakError && (
          <div className="error" role="alert" style={{ marginTop: 6 }}>{speakError}</div>
        )}
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={useDeep} onChange={(e)=>setUseDeep(e.target.checked)} />
          <span className="meter-text">Extra-deep Santa voice</span>
        </label>
      </div>
      {showHistory && (
        <div id="santa-history" className="history-panel" aria-live="polite">
          {history.length === 0 ? (
            <div className="meter-text">No past messages yet.</div>
          ) : (
            <ul className="list" style={{ marginTop: 6 }}>
              {history.map((h, idx) => (
                <li key={idx} className="list-item" style={{ borderBottom: '1px solid #23314f' }}>
                  <div style={{ maxWidth: '72%' }} className="bubble-text clamp" title={h.text}>{h.text}</div>
                  <div className="meter-text" style={{ whiteSpace: 'nowrap' }}>
                    {h.createdAtDate ? formatUpdatedAt(h.createdAtDate) : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="pill-tabs" role="tablist" aria-label="Note type" style={{ marginTop: 12 }}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'gifts'}
          className={`pill-btn ${mode === 'gifts' ? 'active' : ''}`}
          tabIndex={mode === 'gifts' ? 0 : -1}
          aria-controls="santa-note-textarea"
          onClick={() => onModeChange('gifts')}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && mode !== 'gifts') { e.preventDefault(); onModeChange('gifts') } }}
        >
          🎁 Santa Gifts List
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'deeds'}
          className={`pill-btn ${mode === 'deeds' ? 'active' : ''}`}
          tabIndex={mode === 'deeds' ? 0 : -1}
          aria-controls="santa-note-textarea"
          onClick={() => onModeChange('deeds')}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && mode !== 'deeds') { e.preventDefault(); onModeChange('deeds') } }}
        >
          ⭐ Good Deeds
        </button>
      </div>

      <label htmlFor="santa-note-textarea">
        <span className="sr-only">Your note to Santa</span>
        <textarea
          id="santa-note-textarea"
          value={noteText}
          onChange={(e) => { onChangeNote(e.target.value); if (emptyHint) setEmptyHint(null) }}
          placeholder={mode === 'gifts' ? 'Tell Santa what kind of gift you’re dreaming about…' : 'Tell Santa what you did today to help or show kindness…'}
          rows={4}
          aria-label="Your note to Santa"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
        />
      </label>
      {(!canSubmit) && (
        <div className="error" role="alert" style={{ marginTop: 6 }}>Please choose a child.</div>
      )}
      {emptyHint && canSubmit && (
        <div className="error" role="alert" style={{ marginTop: 6 }}>{emptyHint}</div>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        <button
          className="btn"
          onClick={handleSubmit}
          disabled={!canSend}
          aria-disabled={!canSend}
        >
          Send to Santa
        </button>
        {searching && (
          <div className="santa-reading" role="status" aria-live="polite">
            <span>🎁 Santa is searching…</span>
            <span className="dot" />
            <span className="dot d2" />
            <span className="dot d3" />
          </div>
        )}
        {reading && (
          <div className="santa-reading" role="status" aria-live="polite">
            <span>✍️ Santa is reading your note…</span>
            <span className="dot" />
            <span className="dot d2" />
            <span className="dot d3" />
          </div>
        )}
        {toast && (
          <div className="badge" role="status">
            {toast}
            {undoAvailable && onUndo && (
              <button className="btn secondary" style={{ marginLeft: 8 }} onClick={onUndo}>Undo</button>
            )}
          </div>
        )}
      </div>

      {mode === 'gifts' && Array.isArray(giftResults) && giftResults.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h4 style={{ margin: '0 0 8px 0' }}>Gift ideas from the Workshop</h4>
          <div className="grid3">
            {giftResults.map((r, idx) => (
              <div key={idx} className="card item">
                <div className="item-top">
                  <div>
                    <h4 style={{ margin: '4px 0' }}>{r.title}</h4>
                    <span className={`badge retailer ${r.retailer}`}>{r.retailer}</span>
                    {r.url && <div><a className="link" href={r.url} target="_blank" rel="noreferrer">View</a></div>}
                  </div>
                  {r.image && <Image src={r.image} alt={r.title} width={96} height={96} style={{ objectFit: 'cover' }} />}
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn" onClick={() => onAddGift(r)}>Add to List</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
