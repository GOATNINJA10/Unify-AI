"use client"

import React, { useState, useEffect, useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"

import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Paperclip, ArrowUp, Zap, Globe, Repeat } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Message {
  id: number
  model: string
  text: string
  isUser: boolean
}

interface HealthStatus {
  status: 'success' | 'warning' | 'error'
  message: string
  missing?: string[]
  services?: {
    together?: string
    environment?: string
    [key: string]: any
  }
}

// Helper: Convert LaTeX delimiters for remark-math compatibility
function convertLatexDelimiters(text: string): string {
  // Convert \( ... \) to $...$
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_, expr) => `$${expr}$`)
  // Convert \[ ... \] to $$...$$
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, expr) => `$$${expr}$$`)
  // Convert all $$...$$ (inline) to $...$ if not already block math
  // This is optional and depends on your AI output style
  // You may skip this if your AI uses $...$ for inline and $$...$$ for block
  return text
}

export default function DeepSeekChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [selectedModel, setSelectedModel] = useState<"scira" | "deepseek" | "chained">("chained")
  const [isLoading, setIsLoading] = useState(false)
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(true)
  const { toast } = useToast()
  const messageIdRef = useRef(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    checkSystemHealth()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const checkSystemHealth = async () => {
    setIsCheckingHealth(true)
    try {
      const response = await fetch("/api/health")
      const data = await response.json()
      setHealthStatus(data)
      if (data.status === "error") {
        toast({
          title: "System Warning",
          description: data.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      setHealthStatus({
        status: "warning",
        message: "Health check failed, but you can still try to use the chat",
        services: {
          together: "unknown",
          environment: "unknown"
        }
      })
    } finally {
      setIsCheckingHealth(false)
    }
  }

  const handleNewChat = () => {
    setMessages([])
    setInput("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const message = input.trim()
    if (!message) {
      toast({
        title: "Validation Error",
        description: "Please enter a message before sending.",
        variant: "destructive",
      })
      return
    }
    if (healthStatus?.status === "error") {
      toast({
        title: "System Error",
        description: healthStatus.message || "Please check your configuration.",
        variant: "destructive",
      })
      return
    }
    setInput("")
    const userMessage: Message = {
      id: messageIdRef.current++,
      model: "user",
      text: message,
      isUser: true,
    }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage.text, model: selectedModel }),
      })

      if (!res.ok) {
        let errorMsg = "Failed to get AI response"
        try {
          const errorData = await res.json()
          errorMsg = errorData?.error || errorMsg
        } catch {
          const errorText = await res.text()
          if (errorText) errorMsg = errorText
        }
        throw new Error(errorMsg)
      }

      const data = await res.json()
      const aiResponseText = data.finalOutput || "No response"

      const aiMessage: Message = {
        id: messageIdRef.current++,
        model: selectedModel,
        text: aiResponseText,
        isUser: false,
      }
      setMessages((prev) => [...prev, aiMessage])
      toast({
        title: "Success",
        description: "Response received",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get AI response",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const getModelIcon = (model: string) => {
    switch (model) {
      case "scira":
        return <Zap className="h-4 w-4" />
      case "deepseek":
      case "deepseek-r1":
        return <Globe className="h-4 w-4" />
      case "chained":
        return <Globe className="h-4 w-4" />
      default:
        return null
    }
  }

  const getModelName = (model: string) => {
    switch (model) {
      case "scira": return "Scira"
      case "deepseek":
      case "deepseek-r1": return "DeepSeek R1"
      case "chained": return "Chained"
      default: return model
    }
  }

  return (
    <TooltipProvider>
      <div
        className={`min-h-screen bg-gray-950 flex flex-col px-4 ${
          messages.length === 0 ? "justify-center items-center" : "justify-start items-center"
        }`}
      >
        <div className="text-center mt-2 mb-8">
          <Zap className="mx-auto mb-2 h-10 w-10 text-blue-500" />
          <h1 className="text-white text-2xl font-semibold">Hi, I'm Unify.</h1>
          <p className="text-gray-400 mt-1">How can I help you today?</p>
        </div>

        {messages.length > 0 && (
          <main className="flex-1 w-full max-w-2xl overflow-y-auto mb-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-lg ${
                  msg.isUser ? "bg-blue-700 text-white self-end" : "bg-gray-800 text-gray-300 self-start"
                }`}
              >
                <div className="flex items-center mb-2 gap-2">
                  {!msg.isUser && getModelIcon(msg.model)}
                  <span className="font-semibold">{msg.isUser ? "You" : getModelName(msg.model)}</span>
                </div>
                <div className="prose prose-invert max-w-none whitespace-pre-wrap">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {convertLatexDelimiters(msg.text)}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </main>
        )}

        <form onSubmit={handleSubmit} className="relative w-full max-w-2xl">
          <div className="relative bg-gray-800 rounded-lg px-6 py-6 mb-2">
            <textarea
              ref={inputRef}
              placeholder="Message DeepSeek"
              className="w-full bg-transparent border-none outline-none text-white placeholder-gray-400 text-lg resize-none overflow-hidden pr-32 pb-10 whitespace-normal break-normal"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              disabled={isLoading}
              rows={1}
              style={{ minHeight: '1rem' }}
              aria-label="Message input"
              onInput={(e: React.FormEvent<HTMLTextAreaElement>) => {
                const target = e.currentTarget
                target.style.height = 'auto'
                const newHeight = Math.min(target.scrollHeight, 200)
                target.style.height = `${newHeight}px`
                target.style.overflowY = newHeight >= 200 ? 'auto' : 'hidden'
              }}
            />
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as "chained" | "scira" | "deepseek")}
              className="absolute bottom-4 left-4 bg-gray-700 text-gray-300 text-xs rounded-md px-2 py-1 cursor-pointer"
              title="Select Model"
              aria-label="Model selection"
              disabled={isLoading}
            >
              <option value="chained">Chained Processing (Scira → DeepSeek R1)</option>
              <option value="scira">Scira Only</option>
              <option value="deepseek">DeepSeek R1 Only</option>
            </select>
            <div className="absolute bottom-4 right-4 flex items-center space-x-2">
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="text-blue-500 hover:text-blue-400 disabled:text-gray-600 disabled:cursor-not-allowed"
                aria-label="Send message"
                title={isLoading ? "Processing..." : !input.trim() ? "Please enter a message" : "Send message"}
              >
                {isLoading ? <Repeat className="h-6 w-6 animate-spin text-blue-500" /> : <ArrowUp className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </form>
      </div>
    </TooltipProvider>
  )
}
