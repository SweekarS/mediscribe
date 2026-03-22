import { useRef, useState, useEffect, useCallback } from 'react'

const NARRATIVE_BEATS = [
  {
    title: 'You speak your language.',
    body: "Tell your doctor what\u2019s wrong \u2014 in Spanish, Mandarin, Hindi, or any of 32 supported languages. MediScribe listens.",
  },
  {
    title: 'MediScribe translates instantly.',
    body: "Your words are transcribed, translated, and delivered to your doctor in under 150 milliseconds \u2014 faster than a blink.",
  },
  {
    title: 'Your doctor responds clearly.',
    body: "When your doctor speaks, MediScribe doesn\u2019t just translate \u2014 it simplifies medical jargon so you truly understand your care.",
  },
]

const SPANISH_FULL = '\u201cMe duele mucho el pecho al respirar profundo\u2026\u201d'
const ENGLISH_FULL = 'My chest hurts a lot when I breathe deeply\u2026'

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

function useScrollProgress(ref) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect()
        const viewH = window.innerHeight
        const total = el.scrollHeight - viewH
        const scrolled = -rect.top
        setProgress(clamp(scrolled / total, 0, 1))
        ticking = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [ref])

  return progress
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

function Typewriter({ text, progress, label, reducedMotion }) {
  if (reducedMotion) {
    return (
      <span>
        {label && <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-white/60">{label}</span>}
        {text}
      </span>
    )
  }

  const len = Math.floor(progress * text.length)
  const visible = text.slice(0, len)
  const showCursor = progress > 0 && progress < 1

  return (
    <span>
      {label && <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-white/60">{label}</span>}
      {visible}
      {showCursor && <span className="inline-block w-[2px] animate-blink bg-white/80 ml-px">&nbsp;</span>}
    </span>
  )
}

export default function PatientExperienceScrolly() {
  const trackRef = useRef(null)
  const p = useScrollProgress(trackRef)
  const reducedMotion = useReducedMotion()

  const laptopEntry = reducedMotion ? 1 : easeOutCubic(clamp(p / 0.25, 0, 1))
  const laptopScale = lerp(0.7, 1, laptopEntry)
  const laptopY = lerp(60, 0, laptopEntry)
  const laptopOpacity = laptopEntry

  const beatCount = NARRATIVE_BEATS.length
  const beatZone = 0.6
  const beatStart = 0.2
  const beatWidth = beatZone / beatCount

  const activeBeatIndex = Math.min(
    Math.floor((p - beatStart) / beatWidth),
    beatCount - 1
  )

  const typewriterStart = 0.55
  const typewriterEnd = 0.95
  const typewriterP = clamp((p - typewriterStart) / (typewriterEnd - typewriterStart), 0, 1)
  const spanishP = clamp(typewriterP / 0.45, 0, 1)
  const englishP = clamp((typewriterP - 0.5) / 0.45, 0, 1)

  return (
    <section
      ref={trackRef}
      className="relative bg-surface-container"
      style={{ height: '340vh' }}
      aria-label="How MediScribe works"
    >
      <div className="sticky top-0 flex h-screen w-full items-center overflow-hidden px-6 md:px-12">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 lg:flex-row lg:items-center lg:gap-16">
          {/* Left column — narrative beats */}
          <div className="w-full shrink-0 lg:max-w-md xl:max-w-lg">
            <div className="mb-6 h-1 w-12 bg-secondary" />
            <h2 className="mb-8 text-4xl font-black tracking-tight text-primary md:text-5xl">
              Understand your doctor in real time.
            </h2>

            <div className="relative min-h-[180px]">
              {NARRATIVE_BEATS.map((beat, i) => {
                const isActive = reducedMotion || (activeBeatIndex === i && p >= beatStart)
                const beatLocalP = clamp(
                  (p - (beatStart + i * beatWidth)) / beatWidth,
                  0,
                  1
                )
                const fadeIn = clamp(beatLocalP * 4, 0, 1)
                const fadeOut = clamp((1 - beatLocalP) * 4, 0, 1)
                const opacity = reducedMotion ? (isActive ? 1 : 0) : Math.min(fadeIn, fadeOut)
                const blur = reducedMotion ? 0 : lerp(4, 0, Math.min(fadeIn, fadeOut))

                return (
                  <div
                    key={i}
                    className="absolute inset-0 transition-none"
                    style={{
                      opacity,
                      filter: blur > 0.1 ? `blur(${blur}px)` : 'none',
                      pointerEvents: isActive ? 'auto' : 'none',
                    }}
                    aria-hidden={!isActive}
                  >
                    <h3 className="mb-3 text-xl font-bold text-on-surface md:text-2xl">{beat.title}</h3>
                    <p className="text-base leading-relaxed text-on-surface-variant md:text-lg">{beat.body}</p>
                  </div>
                )
              })}
            </div>

            <ul className="mt-8 space-y-3">
              <li className="flex items-center gap-3 font-semibold text-secondary">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
                32 languages including mixed-language support
              </li>
              <li className="flex items-center gap-3 font-semibold text-secondary">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
                Live translations in 10,000+ natural voices
              </li>
            </ul>
          </div>

          {/* Right column — laptop with translation card */}
          <div
            className="relative mx-auto w-full max-w-2xl shrink-0 lg:mx-0"
            style={
              reducedMotion
                ? {}
                : {
                    transform: `translateY(${laptopY}px) scale(${laptopScale})`,
                    opacity: laptopOpacity,
                  }
            }
          >
            <div className="relative w-full overflow-hidden rounded-xl border border-outline-variant/10 bg-slate-900 shadow-2xl">
              {/* Fake window chrome */}
              <div className="flex h-8 w-full shrink-0 items-center gap-2 bg-surface-container-high px-4">
                <div className="h-2 w-2 rounded-full bg-error/40" />
                <div className="h-2 w-2 rounded-full bg-tertiary/40" />
                <div className="h-2 w-2 rounded-full bg-secondary/40" />
              </div>

              <div className="relative aspect-[16/10] w-full bg-primary/40">
                <div className="flex h-full w-full items-center justify-center pt-16">
                  <span className="material-symbols-outlined text-[72px] text-white/25 md:text-[96px]">laptop_mac</span>
                </div>

                {/* Translation card overlay */}
                <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                  <div className="rounded-xl border border-white/20 bg-white/10 p-4 shadow-lg backdrop-blur-lg">
                    <div className="mb-2 flex items-center gap-3">
                      <div className="h-2 w-2 shrink-0 rounded-full bg-secondary" />
                      <span className="text-xs font-bold uppercase tracking-widest text-white">Live Translation</span>
                      <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-white/60">ES</span>
                    </div>

                    <p className="min-h-[3.25rem] text-sm font-medium italic leading-relaxed text-white">
                      <Typewriter
                        text={SPANISH_FULL}
                        progress={spanishP}
                        label="ES"
                        reducedMotion={reducedMotion}
                      />
                    </p>

                    <div className="mt-2 min-h-[1.5rem]">
                      {(englishP > 0 || reducedMotion) && (
                        <span className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase text-white/90">
                          <span
                            className="material-symbols-outlined text-[14px]"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            check_circle
                          </span>
                          <Typewriter
                            text={`English: ${ENGLISH_FULL}`}
                            progress={englishP}
                            reducedMotion={reducedMotion}
                          />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Laptop chin */}
              <div
                className="h-2 w-[55%] rounded-b-md bg-slate-700/90"
                style={{ marginLeft: 'auto', marginRight: 'auto', marginTop: '-1px' }}
                aria-hidden
              />
            </div>
          </div>
        </div>

        {/* Scroll progress dots */}
        <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 gap-2">
          {NARRATIVE_BEATS.map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-all duration-300 ${
                activeBeatIndex === i && p >= beatStart
                  ? 'scale-125 bg-primary'
                  : 'bg-outline-variant/40'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
