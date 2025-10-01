'use client'

import { useEffect, useRef } from 'react'

export default function Snowfall() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const snowflakes = []
    const snowflakeCount = 50

    class Snowflake {
      constructor() {
        this.x = Math.random() * canvas.width
        this.y = Math.random() * canvas.height
        this.radius = Math.random() * 3 + 1
        this.speed = Math.random() * 1 + 0.5
        this.wind = Math.random() * 0.5 - 0.25
      }

      update() {
        this.y += this.speed
        this.x += this.wind

        if (this.y > canvas.height) {
          this.y = 0
          this.x = Math.random() * canvas.width
        }
      }

      draw() {
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
        ctx.fill()
      }
    }

    for (let i = 0; i < snowflakeCount; i++) {
      snowflakes.push(new Snowflake())
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      snowflakes.forEach(snowflake => {
        snowflake.update()
        snowflake.draw()
      })
      requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.6 }}
    />
  )
}