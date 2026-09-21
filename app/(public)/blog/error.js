"use client"

import { useEffect } from "react"
import { BlogError } from "@/components/blog/BlogStates"

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return <BlogError reset={reset} />
}
