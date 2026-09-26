"use client"

import { useEffect, useRef, useState } from "react"

// A muted, looping background video that downloads and plays only once it's
// near the viewport, and pauses while off-screen. Looks the same as
// <video autoPlay muted loop playsInline> — without every section's video
// downloading in full at page load.
export default function LazyVideo({ src, type = "video/mp4", className = "", poster }) {
  const ref = useRef(null)
  const [load, setLoad] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      setLoad(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoad(true)
          el.play?.().catch(() => {})
        } else {
          el.pause?.()
        }
      },
      { rootMargin: "300px 0px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Start as soon as the source is attached.
  useEffect(() => {
    if (load) ref.current?.play?.().catch(() => {})
  }, [load])

  return (
    <video ref={ref} muted loop playsInline preload={load ? "auto" : "none"} poster={poster} className={className}>
      {load && <source src={src} type={type} />}
    </video>
  )
}
