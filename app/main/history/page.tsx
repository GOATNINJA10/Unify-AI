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
  fileName?: string
  fileType?: string
  fileUrl?: string
  // Optional responses array for chained messages
  responses?: { model: string; text: string }[]
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
  const [conversations, setConversations] = useState<Array<{id: string, title: string, updatedAt: string, messageCount: number}>>([])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (status === "authenticated" && session?.user?.email) {
      fetchConversations()
    }
  }, [status, session, router])

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: session?.user?.email, listConversations: true }),
      })
      if (!res.ok) {
        throw new Error("Failed to fetch conversations")
      }
      const data = await res.json()
      if (data.conversations && Array.isArray(data.conversations)) {
        setConversations(data.conversations.map((conv: any) => ({
          id: conv.id,
          title: conv.title,
          updatedAt: conv.updatedAt,
          messageCount: conv._count?.messages || 0,
        })))
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load conversations",
        variant: "destructive",
      })
    }
  }

  const fetchChatHistory = async (convId: string) => {
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: session?.user?.email, conversationId: convId, query: "", model: "chained" }),
      })
      if (!res.ok) {
        throw new Error("Failed to fetch chat history")
      }
      const data = await res.json()
      if (data.messages && Array.isArray(data.messages)) {
        // Group consecutive chained model messages
        const groupedMessages: Message[] = []
        let i = 0
        while (i < data.messages.length) {
          const msg = data.messages[i]
          if (msg.model !== "chained" && msg.model !== "user") {
            // Check if next message has same conversation and is also AI message with different model
            // Group consecutive AI messages with different models as chained responses
            const responses = [msg]
            let j = i + 1
            while (j < data.messages.length && data.messages[j].isUser === false) {
              responses.push(data.messages[j])
              j++
            }
            if (responses.length > 1) {
              groupedMessages.push({
                id: `group-${msg.id}`,
                model: "chained",
                text: "",
                isUser: false,
                responses: responses.map((r: any) => ({
                  model: r.model,
                  text: r.content,
                })),
              })
              i = j
            } else {
              groupedMessages.push({
                id: msg.id,
                model: msg.model || "unknown",
                text: msg.content,
                isUser: msg.isUser,
              })
              i++
            }
          } else {
            groupedMessages.push({
              id: msg.id,
              model: msg.model || "unknown",
              text: msg.content,
              isUser: msg.isUser,
            })
            i++
          }
        }
        setMessages(groupedMessages)
        setConversationId(data.conversationId || null)
        // Scroll to bottom after loading messages
        setTimeout(() => {
          const messagesEnd = document.getElementById("messages-end")
          if (messagesEnd) {
            messagesEnd.scrollIntoView({ behavior: "smooth" })
          }
        }, 100)
      }
      // Force re-render by updating state with a new array reference
      setMessages((prev) => [...prev])
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
          <Button onClick={() => router.push("/main/")}>Back to Chat</Button>
          <Button onClick={() => signOut()}>Sign Out</Button>
          <Avatar>
            <AvatarFallback>{session?.user?.email?.[0].toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>
        <div className="text-center mt-2 mb-8 w-full max-w-2xl">
          <h1 className="text-white text-2xl font-semibold mb-4">Chat History</h1>
          {conversations.length === 0 && <p className="text-gray-400">No conversations found.</p>}
          {conversations.length > 0 && (
            <main className="overflow-y-auto space-y-4 max-h-[70vh]">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className="p-4 rounded-lg bg-gray-800 text-gray-300 cursor-pointer hover:bg-gray-700"
                  onClick={() => {
                    fetchChatHistory(conv.id)
                    setConversationId(conv.id)
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      fetchChatHistory(conv.id)
                      setConversationId(conv.id)
                    }
                  }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">{conv.title || "Untitled Conversation"}</span>
                    <span className="text-xs text-gray-400">{new Date(conv.updatedAt).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-gray-400">{conv.messageCount} messages</div>
                </div>
          ))}
            </main>
          )}
          {messages.length > 0 && (
            <>
              <h2 className="text-white text-xl font-semibold mt-6 mb-4">Messages</h2>
              <main className="overflow-y-auto space-y-4 max-h-[50vh] w-full">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-lg ${
                      msg.isUser ? "bg-blue-700 text-white self-end" : "bg-gray-800 text-gray-300 self-start"
                    }`}
                  >
                    {msg.model === "chained" && msg.responses ? (
                      <div className="flex gap-4 max-w-full overflow-auto">
                        {msg.responses.map((resp, index) => (
                          <div key={index} className="flex-1 border border-gray-600 rounded p-4 overflow-auto max-h-96">
                            <div className="flex items-center mb-2 gap-2">
                              {getModelIcon(resp.model)}
                              <span className="font-semibold">{getModelName(resp.model)}</span>
                            </div>
                            <div className="prose prose-invert max-w-none whitespace-pre-wrap">
                              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {convertLatexDelimiters(resp.text)}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center mb-2 gap-2">
                          {!msg.isUser && getModelIcon(msg.model)}
                          <span className="font-semibold">{msg.isUser ? "You" : getModelName(msg.model)}</span>
                        </div>
                    <div className="prose prose-invert max-w-none whitespace-pre-wrap">
                      {msg.fileUrl ? (
                        msg.fileType?.startsWith("image/") ? (
                          <img src={msg.fileUrl} alt={msg.fileName || "Uploaded image"} className="max-w-xs rounded-md" />
                        ) : (
                          <a
                            href={msg.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 underline break-all"
                            download={msg.fileName || undefined}
                          >
                            {msg.fileName || "Download file"}
                          </a>
                        )
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {convertLatexDelimiters(msg.text)}
                        </ReactMarkdown>
                      )}
                    </div>
                      </>
                    )}
                  </div>
                ))}
                <div id="messages-end" />
              </main>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
