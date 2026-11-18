import { useEffect, useRef, useState } from 'react'
import { cathSvg } from '../../shared/cath/cath'
import type { GameState } from '../engine/types'
import { POSTCARD_H, POSTCARD_W, drawPostcard, postcardData } from './dailyPostcard'

// Plan item 484: the Daily's end screen shows a market-day postcard (dailyPostcard.ts) with Share (the image, where
// the browser can share files) or Save image; the text share stays under it as the fallback.
export default function DailyPostcard({ state, daily, grade }: { state: GameState; daily: { number: number; streak: number; layoutName: string }; grade: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [note, setNote] = useState('')
  const data = postcardData(state, daily, grade)
  const key = JSON.stringify(data)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let live = true
    const svg = cathSvg({ framing: 'bust', expression: data.won ? 'delighted' : 'determined', width: 208, height: 208 })
    const img = new Image()
    const paint = (face: HTMLImageElement | null) => live && drawPostcard(canvas, data, face)
    paint(null)
    img.onload = () => paint(img)
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    void document.fonts?.ready.then(() => paint(img.complete && img.naturalWidth ? img : null))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const blob = () =>
    new Promise<Blob | null>((ok) => {
      if (ref.current) ref.current.toBlob(ok, 'image/png')
      else ok(null)
    })
  const name = `cathnivore-daily-${data.number}.png`
  const save = async () => {
    const b = await blob()
    if (!b) return setNote('Could not make the image')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(b)
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    setNote('Postcard saved')
  }
  const share = async () => {
    const b = await blob()
    const file = b ? new File([b], name, { type: 'image/png' }) : null
    if (file && navigator.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({ files: [file], title: `Cathnivore Daily Market #${data.number}` })
      } catch {
        /* the player closed the share sheet */
      }
      return
    }
    await save()
  }
  const canFiles = typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare
  return (
    <figure className="daily-postcard" data-daily-postcard={data.number} data-won={data.won ? 'true' : 'false'}>
      <canvas ref={ref} width={POSTCARD_W} height={POSTCARD_H} role="img" aria-label={`Postcard: Daily Market #${data.number}, ${data.won ? `liberated in ${data.rounds} rounds` : `held out to round ${data.rounds}`}, Trust ${data.trust}. Cath: ${data.verdict}`} />
      <figcaption>
        <button className="secondary daily-postcard-share" onClick={canFiles ? share : save}>
          {canFiles ? 'Share postcard' : 'Save image'}
        </button>
        <span className="daily-postcard-note" role="status">
          {note}
        </span>
      </figcaption>
    </figure>
  )
}
