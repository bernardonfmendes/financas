import { useRef, useState, type PointerEvent, type ReactNode } from 'react'

interface SwipeableRowProps {
  children: ReactNode
  /** Deslizar para a esquerda (apagar). */
  onSwipeLeft: () => void
  /** Deslizar para a direita (editar). */
  onSwipeRight: () => void
}

/** Distância mínima, em pixels, para o gesto contar. */
const THRESHOLD = 90
/** Distância máxima que a linha acompanha o dedo. */
const MAX_OFFSET = 140
/** Movimento mínimo antes de decidir se é um gesto horizontal. */
const DEAD_ZONE = 8

export function SwipeableRow({ children, onSwipeLeft, onSwipeRight }: SwipeableRowProps) {
  const [offset, setOffset] = useState(0)
  const [animating, setAnimating] = useState(false)
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const dragged = useRef(false)

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    start.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
    dragged.current = false
    setAnimating(false)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = start.current
    if (!current || current.id !== event.pointerId) return

    const dx = event.clientX - current.x
    const dy = event.clientY - current.y

    if (!dragged.current) {
      // Só conta como gesto horizontal: ignora arrastos verticais (são scroll da lista).
      if (Math.abs(dx) < DEAD_ZONE || Math.abs(dy) > Math.abs(dx)) return
      dragged.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    setOffset(Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, dx)))
  }

  function finishGesture() {
    const wasDragged = dragged.current
    const finalOffset = offset

    start.current = null
    setAnimating(true)
    setOffset(0)

    if (!wasDragged) return
    if (finalOffset <= -THRESHOLD) onSwipeLeft()
    else if (finalOffset >= THRESHOLD) onSwipeRight()
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Fundo revelado pelo gesto */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 flex items-center justify-between px-5 text-sm font-semibold text-white ${
          offset > 0 ? 'bg-brand-600' : 'bg-red-600'
        } ${offset === 0 ? 'opacity-0' : 'opacity-100'}`}
      >
        <span>{offset > 0 ? 'Editar' : ''}</span>
        <span>{offset < 0 ? 'Apagar' : ''}</span>
      </div>

      <div
        className={`relative touch-pan-y ${animating ? 'transition-transform duration-200' : ''}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishGesture}
        onPointerCancel={finishGesture}
        onClickCapture={(event) => {
          // Um arrasto não pode disparar o toque do botão interior (abrir o movimento).
          if (dragged.current) {
            event.stopPropagation()
            event.preventDefault()
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
