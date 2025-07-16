import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { ErrorBoundary } from "@/components/error-boundary"
import Provider from "@/components/session-provider"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: "Unify AI",
  description: "Combine Search engine and LLMs",
  generator: "Interns",
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/imagelogo.png" />
        <title>Unify AI</title>
      </head>
      <body>
        <Provider>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Provider>
        <Toaster />
      </body>
    </html>
  )
}
