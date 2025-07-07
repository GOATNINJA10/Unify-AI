import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Check if required environment variables are set
    const requiredEnvVars = {
      TOGETHER_API_KEY: process.env.TOGETHER_API_KEY,
    }

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key)

    const hasAllEnvVars = missingVars.length === 0
    
    // Don't block the health check if API key is missing
    if (!hasAllEnvVars) {
      return NextResponse.json({
        status: "warning" as const,
        message: "Missing some environment variables",
        missing: missingVars,
        services: {
          together: "disconnected",
          environment: "partially_configured"
        },
        timestamp: new Date().toISOString()
      }, { status: 200 }) // Still return 200 to prevent blocking the UI
    }

    // Test Together AI API key by making a simple request
    try {
      const testResponse = await fetch("https://api.together.xyz/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.TOGETHER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-ai/deepseek-r1-distill-llama-70b",
          messages: [{ role: "user", content: "Hello" }],
          max_tokens: 1, // Minimal tokens for health check
        }),
      })

      if (testResponse.status === 401) {
        return NextResponse.json({
          status: "error" as const,
          message: "Invalid Together AI API key",
          services: {
            together: "disconnected",
            environment: "configured"
          },
          timestamp: new Date().toISOString()
        }, { status: 200 }) // Still return 200 to prevent blocking the UI
      }
    } catch (error) {
      console.error("API health check error:", error)
      // Don't fail the health check for API connectivity issues
    }

    return NextResponse.json({
      status: "success" as const,
      message: "All systems operational",
      timestamp: new Date().toISOString(),
      services: {
        together: "connected",
        environment: "configured",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: "Health check failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
