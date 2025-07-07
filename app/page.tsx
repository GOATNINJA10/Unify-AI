"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { webkit } from "playwright"
import '../styles/globals.css';


export default function HomePage() {
  const router = useRouter()

  const handleGetStarted = () => {
    router.push("/main")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-foreground">
      <div className="text-center">
      <h1 className="text-gray-800 text-7xl font-semibold mb-4 animate-shine" 
       style={{
        background: 'linear-gradient(to right, hsl(0, 0%, 30%) 0%, hsl(0, 0%, 100%) 10%, hsl(0, 0%, 30%) 20%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundSize: '400% auto',
        padding: '60px',
      }}
      >
        Unify AI
      </h1>
      <h2
      className="text-gray-200 text-2xl font-semibold mb-20 typewriter-h2"
      >
      All Your Models. One Seamless Flow.
      </h2>
      <Button onClick={handleGetStarted} className="px-8 bg-black text-white py-4 text-lg font-semibold mb-10">
        Get Started
      </Button>
      </div>
    </div>
  )
}
