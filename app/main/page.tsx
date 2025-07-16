"use client"

import React, { useState, useEffect, useRef } from "react"
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
import { Paperclip, ArrowUp, Zap, Globe, Repeat, Mic, ImageIcon, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Toggle } from "@/components/ui/toggle"

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
  const { data: session, status } = useSession()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [selectedModel, setSelectedModel] = useState<"scira" | "deepseek" | "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free" | "meta-llama/Llama-Vision-Free" | "gemma3:1b" | "qwen2.5vl:3b" | "llama3.2" | "qwen2.5-coder:0.5b" | "phi:2.7b" | "tinyllama">("scira")
  const [firstModel, setFirstModel] = useState<"scira" | "deepseek" | "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free" | "meta-llama/Llama-Vision-Free" | "gemma3:1b" | "qwen2.5vl:3b" | "llama3.2" | "qwen2.5-coder:0.5b" | "phi:2.7b" | "tinyllama">("scira")
  const [secondModel, setSecondModel] = useState<"scira" | "deepseek" | "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free" | "meta-llama/Llama-Vision-Free" | "gemma3:1b" | "qwen2.5vl:3b" | "llama3.2" | "qwen2.5-coder:0.5b" | "phi:2.7b" | "tinyllama">("deepseek")
  const [chainedMode, setChainedMode] = useState<boolean>(true)
  const [isLoading, setIsLoading] = useState(false)
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(true)
  const { toast } = useToast()
  const messageIdRef = useRef(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  // New state for conversationId to track chat history
  const [conversationId, setConversationId] = useState<string | null>(null)

  // New state for context mode toggle
  const [contextMode, setContextMode] = useState<boolean>(false)

  // Function to fetch chat history from backend
  const fetchChatHistory = async (convId?: string | null) => {
    if (!session?.user?.email) return
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: session.user.email, query: "", model: selectedModel, conversationId: convId ?? conversationId }),
      })
      if (!res.ok) {
        throw new Error("Failed to fetch chat history")
      }
      const data = await res.json()
      if (data.messages && Array.isArray(data.messages)) {
        // Map messages to frontend Message type
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

  // New states for image upload and mic
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      checkSystemHealth()
      fetchChatHistory()
    }
  }, [status, router])

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null)
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(imageFile)
  }, [imageFile])
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (file) {
      setImageFile(file)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast({
        title: "Error",
        description: "Speech Recognition API not supported in this browser.",
        variant: "destructive",
      })
      console.error("Speech Recognition API not supported in this browser.")
      return
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition: any = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      console.log("Speech recognition result event:", event)
      const transcript = event.results[0][0].transcript
      setInput((prev) => (prev ? prev + " " + transcript : transcript))
    }

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error event:", event)
      let errorMessage = event.error
      if (event.error === 'no-speech') {
        errorMessage = "No speech detected. Please try again and speak clearly."
      }
      toast({
        title: "Error",
        description: `Speech recognition error: ${errorMessage}`,
        variant: "destructive",
      })
      setIsRecording(false)
      recognition.stop()
    }

    recognition.onend = () => {
      console.log("Speech recognition ended")
      setIsRecording(false)
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      setIsRecording(true)
      console.log("Speech recognition started")
    } catch (error) {
      console.error("Error starting speech recognition:", error)
      toast({
        title: "Error",
        description: "Failed to start speech recognition.",
        variant: "destructive",
      })
    }
  }

  const stopRecording = () => {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }

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
    setImageFile(null)
    setImagePreview(null)
    setConversationId(null)
  }

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!input.trim() && !imageFile) {
        toast({
          title: "Validation Error",
          description: "Please enter a message or upload an image before sending.",
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
  
      setIsLoading(true)
  
      const userMessage: Message = {
        id: messageIdRef.current++,
        model: "user",
        text: input,
        isUser: true,
      }
      setMessages((prev) => [...prev, userMessage])
  
      // Prepare payload
      let imageData: string | null = null
      if (imageFile) {
        imageData = await new Promise<string | null>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            resolve(reader.result as string)
          }
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(imageFile)
        })
      }
  
      setInput("")
      setImageFile(null)
      setImagePreview(null)
  
      try {
        const bodyPayload: any = { userEmail: session?.user?.email, query: input, image: imageData, conversationId, contextMode }
        if (chainedMode) {
          bodyPayload.firstModel = firstModel
          bodyPayload.secondModel = secondModel
          bodyPayload.model = "chained"
        } else {
          bodyPayload.model = selectedModel
        }
  
        const res = await fetch("/api/ai-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
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
      case "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free":
      case "meta-llama/Llama-Vision-Free":
        return <Zap className="h-4 w-4" />
      case "gemma3:1b":
      case "qwen2.5vl:3b":
        return <Globe className="h-4 w-4" />
      case "llama3.2":
        return <Globe className="h-4 w-4" />
      case "qwen2.5-coder:0.5b":
        return <Globe className="h-4 w-4" />
      case "phi:2.7b":
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
      case "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free": return "Llama 3.3 70B Instruct Turbo"
      case "meta-llama/Llama-Vision-Free": return "Llama Vision"
      case "gemma3:1b": return "Gemma3 1B"
      case "qwen2.5vl:3b": return "Moondream 1.8B"
      case "llama3.2": return "Llama 3.2"
      case "qwen2.5-coder:0.5b": return "qwen 2.5 Coder"
      case "phi:2.7b": return "Phi 2.7B"
      default: return model
    }
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <TooltipProvider>
      <div
        className={`min-h-screen bg-gray-950 flex flex-col px-4 ${
          messages.length === 0 ? "justify-center items-center" : "justify-start items-center"
        }`}
      >
        <div className="absolute top-4 right-4 flex items-center space-x-4">
          <Button onClick={() => signOut()}>Sign Out</Button>
          <Avatar>
            <AvatarFallback>
              {session?.user?.email?.[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="text-center mt-2 mb-8">
          <Zap className="mx-auto mb-2 h-10 w-10 text-blue-500" />
          <h1 className="text-white text-2xl font-semibold">Hi, I'm Unify.</h1>
          <p className="text-gray-400 mt-1">How can I help you today?</p>
          <button
            onClick={() => router.push("/main/history")}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            aria-label="Load Chat History"
            title="Load Chat History"
          >
            Load Chat History
          </button>
          <button
            onClick={handleNewChat}
            className="mt-2 ml-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            aria-label="New Chat"
            title="New Chat"
          >
            New Chat
          </button>
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
          <div className="flex items-center space-x-4 bg-gray-700 bg-opacity-80 rounded-md px-3 py-1 shadow-md z-10">
              {/* First Model Dropdown */}
              <div className="flex flex-col">
                <label htmlFor="first-model-select" className="text-xs text-gray-400">First Model</label>
                <select
                  id="first-model-select"
                  value={firstModel}
                  onChange={(e) => setFirstModel(e.target.value as typeof firstModel)}
                  className="bg-transparent text-gray-300 text-xs rounded-md px-2 py-1 cursor-pointer"
                  title="Select First Model"
                  aria-label="First model selection"
                  disabled={isLoading}
                >
                  <option value="scira">Scira</option>
                  <option value="deepseek">DeepSeek R1</option>
                  <option value="meta-llama/Llama-3.3-70B-Instruct-Turbo-Free">Llama 3.3 70B Turbo</option>
                  <option value="meta-llama/Llama-Vision-Free">Llama Vision</option>
                  <option value="gemma3:1b">Gemma3 1B</option>
                  <option value="qwen2.5vl:3b">Gemma3 4B</option>
                  <option value="llama3.2">Llama 3.2</option>
                  <option value="qwen2.5-coder:0.5b">Qwen 2.5 Coder</option>
                  <option value="phi:2.7b">Phi 2.7B</option>
                  <option value="tinyllama">TinyLlama</option>
                </select>
              </div>

              {/* Second Model Dropdown (disabled if not in chained mode) */}
              <div className="flex flex-col">
                <label htmlFor="second-model-select" className="text-xs text-gray-400">Second Model</label>
                <select
                  id="second-model-select"
                  value={secondModel}
                  onChange={(e) => setSecondModel(e.target.value as typeof secondModel)}
                  className={`bg-transparent text-gray-300 text-xs rounded-md px-2 py-1 cursor-pointer transition-opacity ${
                    chainedMode ? "opacity-100" : "opacity-50"
                  }`}
                  title="Select Second Model"
                  aria-label="Second model selection"
                  disabled={!chainedMode || isLoading}
                >
                  <option value="scira">Scira</option>
                  <option value="deepseek">DeepSeek R1</option>
                  <option value="meta-llama/Llama-3.3-70B-Instruct-Turbo-Free">Llama 3.3 70B Turbo</option>
                  <option value="meta-llama/Llama-Vision-Free">Llama Vision</option>
                  <option value="gemma3:1b">Gemma3 1B</option>
                  <option value="qwen2.5vl:3b">Gemma3 4B</option>
                  <option value="llama3.2">Llama 3.2</option>
                  <option value="qwen2.5-coder:0.5b">Qwen 2.5 Coder</option>
                  <option value="phi:2.7b">Phi 2.7B</option>
                  <option value="tinyllama">TinyLlama</option>
                </select>
              </div>

              {/* Context Mode Toggle */}
              <div className="flex items-center space-x-2 text-gray-300">
                <label htmlFor="context-mode-toggle" className="text-sm select-none cursor-pointer">
                  Context Mode
                </label>
                <Toggle
                  id="context-mode-toggle"
                  pressed={contextMode}
                  onPressedChange={setContextMode}
                  disabled={isLoading}
                  aria-label="Toggle context mode"
                />
              </div>
            </div>

            <div className="absolute bottom-4 right-4 flex items-center space-x-2">
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="h-16 w-16 rounded-md object-cover" />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-0 right-0 bg-gray-700 rounded-full p-1 text-white hover:bg-gray-600"
                    aria-label="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <label htmlFor="image-upload" className="cursor-pointer text-gray-400 hover:text-white" title="Upload Image" aria-label="Upload Image">
                    <ImageIcon className="h-6 w-6" />
                  </label>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={isLoading}
                  />
                </>
              )}
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`text-gray-400 hover:text-white ${isRecording ? "text-red-500" : ""}`}
                title={isRecording ? "Stop Recording" : "Start Recording"}
                aria-label={isRecording ? "Stop Recording" : "Start Recording"}
                disabled={isLoading}
              >
                <Mic className="h-6 w-6" />
              </button>
              <button
                type="submit"
                disabled={isLoading || (!input.trim() && !imageFile)}
                className="text-blue-500 hover:text-blue-400 disabled:text-gray-600 disabled:cursor-not-allowed"
                aria-label="Send message"
                title={isLoading ? "Processing..." : (!input.trim() && !imageFile) ? "Please enter a message or upload an image" : "Send message"}
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
