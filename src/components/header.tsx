/** Tailark — Copyright (c) 2025 Irung — MIT License. See vendor/tailark/LICENSE. */
import { useEffect, useRef, useState } from 'react'

export function HeroHeader() {
  const [language, setLanguage] = useState('ENG')
  const [open, setOpen] = useState(false)
  const picker = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (!picker.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  return (
    <header className="absolute top-0 z-20 w-full bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-5">
        <a href="#home" aria-label="hangout home" className="inline-flex min-h-11 items-center gap-1.5 text-[27px] font-bold tracking-[-.04em] sm:text-[30px]">
          hangout
          <svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19 19 5M5 5h14v14" /></svg>
        </a>
        <div ref={picker} className="relative" onKeyDown={event => {
          if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
        }} onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
        }}>
          <button ref={trigger} type="button" aria-label={`Choose language, current language ${language}`} aria-expanded={open} aria-controls="language-options" onClick={() => setOpen(!open)} className="flex size-11 items-center justify-center rounded-full transition-colors hover:bg-accent">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18Z"/></svg>
          </button>
          {open && <div id="language-options" role="group" aria-label="Language preview" className="absolute right-0 top-full mt-2 w-32 rounded-xl border border-border bg-background p-1.5 shadow-[0_8px_24px_#24201812]">
            {['EE', 'ENG', 'RU', 'UA'].map(code => (
              <button key={code} type="button" aria-pressed={language === code} onClick={() => { setLanguage(code); setOpen(false); trigger.current?.focus() }} className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-sm transition-colors hover:bg-accent ${language === code ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                {code}
                {language === code && <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ring)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6"/></svg>}
              </button>
            ))}
          </div>}
        </div>
      </div>
    </header>
  )
}
