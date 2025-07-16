"use client"

import React, { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Zap, Globe } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Message {
  id: string
  model: string
  text: string
  isUser: boolean
}

function convertLatexDelimiters(text: string): string {
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_, expr) => `$${expr}$`)
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, expr) => `$$${expr}$$`)
  return text
}

export default function ChatHistory() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (status === "authenticated" && session?.user?.email) {
      fetchChatHistory()
    }
  }, [status, session, router])

  const fetchChatHistory = async () => {
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: session?.user?.email, query: "", model: "chained" }),
      })
      if (!res.ok) {
        throw new Error("Failed to fetch chat history")
      }
      const data = await res.json()
      if (data.messages && Array.isArray(data.messages)) {
        const historyMessages = data.messages.map((msg: any) => ({
          id: msg.id,
          model: msg.model || "unknown",
          text: msg.content,
          isUser: msg.isUser,
        }))
        setMessages(historyMessages)
        setConversationId(data.conversationId || null)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load chat history",
        variant: "destructive",
      })
    }
  }

  const getModelIcon = (model: string) => {
    switch (model) {
      case "scira":
        return <Zap className="h-4 w-4" />
      case "deepseek":
      case "deepseek-r1":
      case "chained":
        return <Globe className="h-4 w-4" />
      default:
        return null
    }
  }

  const getModelName = (model: string) => {
    switch (model) {
      case "scira":
        return "Scira"
      case "deepseek":
      case "deepseek-r1":
        return "DeepSeek R1"
      case "chained":
        return "Chained"
      default:
        return model
    }
  }

  if (status === "unauthenticated") {
    return null
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-950 flex flex-col px-4 justify-start items-center">
        <div className="absolute top-4 right-4 flex items-center space-x-4">
          <Button onClick={() => router.push("/main/page")}>Back to Chat</Button>
          <Button onClick={() => signOut()}>Sign Out</Button>
          <Avatar>
            <AvatarFallback>{session?.user?.email?.[0].toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>
        <div className="text-center mt-2 mb-8 w-full max-w-2xl">
          <h1 className="text-white text-2xl font-semibold mb-4">Chat History</h1>
          {messages.length === 0 && <p className="text-gray-400">No chat history found.</p>}
          {messages.length > 0 && (
            <main className="overflow-y-auto space-y-4 max-h-[70vh]">
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
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {convertLatexDelimiters(msg.text)}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
            </main>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
