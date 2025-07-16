import { type NextRequest, NextResponse } from "next/server"
import { chromium } from "playwright"
import { PrismaClient } from "@prisma/client"

import { remark } from "remark";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const prisma = new PrismaClient();

/**
 * Formats markdown, cleans up references/citations, and supports LaTeX math.
 * @param response Raw markdown string (may include LaTeX formulas)
 * @returns Cleaned and formatted markdown string
 */
export async function formatResponse(response: string): Promise<string> {
  // Remove reference numbers at line starts (e.g., "1\n", "2\n")
  let cleaned = response.replace(/^\s*\d+\s*\n/gm, "\n");
  // Remove citation markers like [1], [2]
  cleaned = cleaned.replace(/\s*\[\d+\]\s*/g, "");
  // Clean up extra spaces before newlines
  cleaned = cleaned.replace(/\s+\n/g, "\n");
  // Limit consecutive newlines to 2
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Process markdown with remark (GFM + math support)
  const processed = await remark()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkStringify, {
      bullet: "-",
      fences: true,
      listItemIndent: "one",
      rule: "-",
      strong: "*",
      emphasis: "_"
    })
    .process(cleaned);

  return String(processed).trim();
}


// Together AI API for DeepSeek R1
async function callDeepSeekR1API(prompt: string): Promise<string> {
  console.log("Calling Together AI's DeepSeek R1 Distill Llama 70B with prompt length:", prompt.length);

  try {
    const API_KEY = process.env.TOGETHER_API_KEY;
    if (!API_KEY) {
      throw new Error("Together API key not found. Please set the TOGETHER_API_KEY environment variable.");
    }

    const model = "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free";
    const apiUrl = "https://api.together.xyz/v1/chat/completions";
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1024,
        temperature: 0.7,
        top_p: 0.9,
        stop: ["</s>"]
      })
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status} - ${response.statusText}`;
      try {
        const errorData = await response.text();
        console.error("Together AI API error response:", errorData);
        try {
          const jsonError = JSON.parse(errorData);
          errorMessage = jsonError.error?.message || jsonError.error || errorMessage;
        } catch (e) {
          errorMessage = errorData || errorMessage;
        }
      } catch (e) {
        console.error("Error parsing error response:", e);
      }
      throw new Error(`Together AI API error: ${errorMessage}`);
    }

    const result = await response.json();
    
    // Handle Together AI's response format
    if (result.choices && result.choices.length > 0 && result.choices[0].message) {
      let completion = result.choices[0].message.content;
      
      // Remove content between <think> tags
      completion = completion.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      
      console.log("✅ Together AI DeepSeek R1 response received");
      return completion;
    } else {
      console.error("Unexpected response format:", result);
      throw new Error("Unexpected response format from Together AI API");
    }
  } catch (error) {
    console.error("Error in callDeepSeekR1API:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to get response from DeepSeek R1: ${errorMessage}`);
  }
}

// Scira API integration (real implementation) using Playwright
async function callSciraAPI(prompt: string): Promise<string> {
  console.log("Calling Scira API with prompt length:", prompt.length)

  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("Prompt must be a non-empty string")
  }

  // Launch browser with optimizations
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-accelerated-2d-canvas',
      '--no-zygote',
      '--single-process',
      '--disable-web-security'
    ]
  })
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1024 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  })
  
  const page = await context.newPage()
  
  try {
    // Set navigation timeout
    page.setDefaultNavigationTimeout(30000)
    
    // Navigate to the page with optimizations
    await page.goto("https://scira.ai", { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    })

    // Wait for the textarea to be visible and ready
    const textareaSelector = 'textarea'
    await page.waitForSelector(textareaSelector, { 
      state: 'visible',
      timeout: 10000 
    })
    
    // Fill the textarea and submit
    await page.fill(textareaSelector, prompt)
    await new Promise(r => setTimeout(r, 100)) // Small delay before pressing enter
    await page.keyboard.press("Enter")

    // Selector for the generated response block
    const responseSelector = ".mt-3.markdown-body.prose.prose-neutral.dark\\:prose-invert.max-w-none.dark\\:text-neutral-200.font-sans"
    
    // Wait for the response container to appear
    await page.waitForSelector(responseSelector, { 
      state: 'attached',
      timeout: 10000 
    })

    let lastText = ""
    let stableCounter = 0
    const maxWaitTime = 40000 // 60 seconds maximum
    const pollInterval = 1000 // Increased from 500ms to 1000ms
    const start = Date.now()
    const maxStableChecks = 3 // Number of stable checks before considering response complete

    while (Date.now() - start < maxWaitTime) {
      const elements = await page.$$(responseSelector)

      if (elements.length > 0) {
        const latest = (await elements[elements.length - 1].innerText()).trim()

        // Skip if same as prompt (AI hasn't replied yet) or empty
        if (!latest || latest.toLowerCase() === prompt.toLowerCase()) {
          await new Promise((r) => setTimeout(r, pollInterval))
          continue
        }

        if (latest === lastText) {
          stableCounter++
          // If text is stable for 3 consecutive checks, consider it done
          if (stableCounter >= maxStableChecks) {
            console.log(`✅ Scira response (${latest.length} chars) received in ${(Date.now() - start) / 1000}s`)
            return formatResponse(latest)
          }
        } else {
          stableCounter = 0
          lastText = latest
        }
      }

      await new Promise((r) => setTimeout(r, pollInterval))
    }
    
    // If we get here, we timed out
    console.warn(`⚠️ Scira API timed out after ${maxWaitTime / 1000}s. Returning partial response.`)
    const partialResponse = lastText || "⚠️ No complete response received within the time limit."
    return formatResponse(partialResponse)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error("Error in callSciraAPI:", errorMessage)
    throw new Error(`Failed to get response from Scira: ${errorMessage}`)
  } finally {
    // Ensure browser is always closed
    await browser.close().catch(console.error)
  }
}

// Main chaining logic with Together AI integration
async function processChainedRequest(query: string) {
  console.log("Processing chained request for query:", query)

  const responses = []
  const startTime = Date.now()

  try {
    // Step 1: Process with Scira
    console.log("Step 1: Processing with Scira")
    const sciraStart = Date.now()
    const sciraResponse = await callSciraAPI(query)
    const sciraTime = Date.now() - sciraStart
    console.log("Scira processing completed in", sciraTime, "ms")

    responses.push({
      model: "scira",
      response: sciraResponse,
      timestamp: Date.now(),
      processingTime: sciraTime,
    })

    // Step 2: Use Scira output as input for DeepSeek R1 with enhanced prompting
    console.log("Step 2: Processing with DeepSeek R1 via Together AI")
    const deepseekStart = Date.now()
    
    // Enhanced prompt for Together AI's DeepSeek R1
    const systemPrompt = `You are DeepSeek R1, an advanced AI assistant. Your task is to refine the following response in a clear, concise manner.`
    
    const chainedPrompt = `## Original User Query
${query}

## Initial Response from Scira
${sciraResponse}

## Your Task
Please provide a concise and well-structured  that:
1. Captures the key points from the initial response
2. Removes any redundancy or unnecessary details
3. Maintains accuracy and preserves important information
4. Is easy to read and understand
5. Is more concise than the original while preserving meaning

## Your Summary:`

    const deepseekResponse = await callDeepSeekR1API(chainedPrompt)
    const deepseekTime = Date.now() - deepseekStart
    console.log("DeepSeek R1 processing completed in", deepseekTime, "ms")

    // Only include the DeepSeek response in the final output
    responses.push({
      model: "deepseek-r1",
      response: deepseekResponse,
      timestamp: Date.now(),
      processingTime: deepseekTime,
    })

    const totalTime = Date.now() - startTime
    console.log("Total chained processing time:", totalTime, "ms")

    return {
      responses,
      finalOutput: deepseekResponse, // Only return the DeepSeek response
      totalTime,
      modelUsed: "deepseek-r1-distill-llama-70b",
      via: "Together AI"
    }
  } catch (error) {
    console.error("Chaining error:", error)
    throw new Error(`Chaining failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
//curl -X POST http://localhost:3000/api/ai-chat -H "Content-Type: application/json" -d '{"userEmail":"abc@gmail.com","conversationId":"cmd5xx0ai0007pjv0soideth4","query":"","model":"chained"}'
// Single model processing
async function processSingleModel(query: string, model: "scira" | "deepseek") {
  console.log("Processing single model request:", model, "for query:", query)

  const startTime = Date.now()
  let response: string

  try {
    if (model === "scira") {
      response = await callSciraAPI(query)
    } else {
      response = await callDeepSeekR1API(query)
    }

    const processingTime = Date.now() - startTime
    console.log("Single model processing completed in", processingTime, "ms")

    return {
      responses: [
        {
          model: model === "deepseek" ? "deepseek-r1" : model,
          response,
          timestamp: Date.now(),
          processingTime,
        },
      ],
      finalOutput: response,
      totalTime: processingTime,
    }
  } catch (error) {
    console.error(`${model} processing error:`, error)
    throw error
  }
}

// New function to process meta-llama models similarly to deepseek
async function processMetaLlamaModel(query: string, model: string) {
  console.log("Processing meta-llama model request:", model, "for query:", query)

  const startTime = Date.now()
  let response: string

  try {
    const API_KEY = process.env.TOGETHER_API_KEY
    if (!API_KEY) {
      throw new Error("Together API key not found. Please set the TOGETHER_API_KEY environment variable.")
    }

    const apiUrl = "https://api.together.xyz/v1/chat/completions"

    const apiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: query,
          },
        ],
        max_tokens: 1024,
        temperature: 0.7,
        top_p: 0.9,
        stop: ["</s>"],
      }),
    })

    if (!apiResponse.ok) {
      let errorMessage = `HTTP ${apiResponse.status} - ${apiResponse.statusText}`
      try {
        const errorData = await apiResponse.text()
        console.error("Together AI API error response:", errorData)
        try {
          const jsonError = JSON.parse(errorData)
          errorMessage = jsonError.error?.message || jsonError.error || errorMessage
        } catch (e) {
          errorMessage = errorData || errorMessage
        }
      } catch (e) {
        console.error("Error parsing error response:", e)
      }
      throw new Error(`Together AI API error: ${errorMessage}`)
    }

    const result = await apiResponse.json()

    if (result.choices && result.choices.length > 0 && result.choices[0].message) {
      let completion = result.choices[0].message.content

      // Remove content between <think> tags
      completion = completion.replace(/<think>[\s\S]*?<\/think>/g, "").trim()

      const processingTime = Date.now() - startTime
      console.log("Meta-llama model processing completed in", processingTime, "ms")

      return {
        responses: [
          {
            model,
            response: completion,
            timestamp: Date.now(),
            processingTime,
          },
        ],
        finalOutput: completion,
        totalTime: processingTime,
      }
    } else {
      console.error("Unexpected response format:", result)
      throw new Error("Unexpected response format from Together AI API")
    }
  } catch (error) {
    console.error("Meta-llama model processing error:", error)
    throw error
  }
}

// New function to process Ollama models
async function processOllamaModel(query: string, model: string) {
  console.log("Processing Ollama model request:", model, "for query:", query)

  const startTime = Date.now()

  try {
    const apiUrl = "http://localhost:11434/api/chat" // Standard Ollama API endpoint

    const apiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: query,
          },
        ],
        stream: false // For simplicity, not using streaming responses
      }),
    })

    if (!apiResponse.ok) {
      let errorMessage = `HTTP ${apiResponse.status} - ${apiResponse.statusText}`
      try {
        const errorData = await apiResponse.text()
        console.error("Ollama API error response:", errorData)
        try {
          const jsonError = JSON.parse(errorData)
          errorMessage = jsonError.error?.message || jsonError.error || errorMessage
        } catch (e) {
          errorMessage = errorData || errorMessage
        }
      } catch (e) {
        console.error("Error parsing error response:", e)
      }
      throw new Error(`Ollama API error: ${errorMessage}`)
    }

    const result = await apiResponse.json()

    if (result.message && result.message.content) {
      const completion = result.message.content
      const processingTime = Date.now() - startTime
      console.log("Ollama model processing completed in", processingTime, "ms")

      return {
        responses: [
          {
            model,
            response: completion,
            timestamp: Date.now(),
            processingTime,
          },
        ],
        finalOutput: completion,
        totalTime: processingTime,
      }
    } else {
      console.error("Unexpected response format:", result)
      throw new Error("Unexpected response format from Ollama API")
    }
  } catch (error) {
    console.error("Ollama model processing error:", error)
    throw error
  }
}
export async function POST(request: NextRequest) {
  console.log("API route called")

  try {
    const body = await request.json()
    console.log("Request body:", body)

    let { query, model, image, conversationId, userEmail, listConversations } = body

    if (!userEmail || typeof userEmail !== "string") {
      console.error("Invalid or missing userEmail:", userEmail)
      return NextResponse.json({ error: "Valid userEmail is required" }, { status: 400 })
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    })

    if (!user) {
      console.error("User not found for email:", userEmail)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // If listConversations flag is true, return list of user's conversations
    if (listConversations === true) {
      const conversations = await prisma.conversation.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          updatedAt: true,
          _count: { select: { messages: true } },
        },
      })
      return NextResponse.json({ conversations })
    }

    // If query is empty string or missing, treat as fetch chat history request
    if ((!query || query.trim() === "") && user) {
      if (conversationId && conversationId !== "new") {
        const conversation = await prisma.conversation.findFirst({
          where: { id: conversationId, userId: user.id },
          include: { messages: { orderBy: { createdAt: "asc" } } },
        })

        if (!conversation) {
          return NextResponse.json({ error: "Conversation not found or does not belong to user" }, { status: 404 })
        }

        return NextResponse.json({
          conversationId: conversation.id,
          messages: conversation.messages,
        })
      }

      // fallback: load most recent conversation or create a new one
      let conversation = await prisma.conversation.findFirst({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      })

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            title: "New Conversation",
            userId: user.id,
          },
          include: { messages: true },
        })
      }

      return NextResponse.json({
        conversationId: conversation.id,
        messages: conversation.messages,
      })
    }

    if (query === undefined || query === null || typeof query !== "string") {
      console.error("Invalid query:", query)
      return NextResponse.json({ error: "Query is required and must be a string" }, { status: 400 })
    }

    if (!model || !["scira", "deepseek", "chained", "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free", "meta-llama/Llama-Vision-Free", "gemma3:1b", "qwen2.5vl:3b", "llama3.2", "qwen2.5-coder:0.5b", "phi:2.7b", "tinyllama"].includes(model)) {
      console.error("Invalid model:", model)
      return NextResponse.json({ error: "Valid model selection is required" }, { status: 400 })
    }

    // Check if Together AI API key is configured
    if (!process.env.TOGETHER_API_KEY) {
      console.error("TOGETHER API key not configured")
      return NextResponse.json({ error: "TOGETHER API key not configured" }, { status: 500 })
    }

    // If image data is present and model supports vision, modify the query to include image description prompt
    const visionModels = [
      "meta-llama/Llama-Vision-Free",
      "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
      "gemma3:1b",
      "qwen2.5vl:3b",
      "llama3.2",
      "qwen2.5-coder:0.5b",
      "phi:2.7b",
      "tinyll"
    ]
    if (image && visionModels.includes(model)) {
      // Here we prepend a prompt to instruct the model to describe the image
      query = `Describe the following image in detail:\n[Image data included]\nUser query: ${query}`
      // Note: The actual image data is not passed in the prompt string here.
      // If the model API supports image data input, this should be handled accordingly.
      // For now, we rely on the model's vision capability to process the image data sent separately.
    }

    // Fetch or create conversation if conversationId or userId is provided
    let conversation = null
    if (conversationId && conversationId !== "new") {
      conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: user.id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      })
      if (!conversation) {
        return NextResponse.json({ error: "Conversation not found or does not belong to user" }, { status: 404 })
      }
    } else if (user) {
      // Create new conversation if conversationId is "new" or null
      conversation = await prisma.conversation.create({
        data: {
          title: "New Conversation",
          userId: user.id,
        },
        include: { messages: true },
      })
    }

    // Store user message if conversation exists
    if (conversation) {
      await prisma.message.create({
        data: {
          content: query,
          isUser: true,
          conversationId: conversation.id,
          model,
        },
      })
    }

    console.log("Processing request with model:", model)
    let result: any = null

    if (model === "chained") {
      result = await processChainedRequest(query)
    } else if (model === "scira" || model === "deepseek") {
      result = await processSingleModel(query, model as "scira" | "deepseek")
    } else if (model === "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free" || model === "meta-llama/Llama-Vision-Free") {
      // For these models, call Together AI API with the model name directly
      result = await processMetaLlamaModel(query, model)
    } else if (model === "gemma3:1b" || model === "qwen2.5vl:3b" || model === "llama3.2" || model === "qwen2.5-coder:0.5b" || model === "phi:2.7b" || model === "tinyllama") {
      result = await processOllamaModel(query, model)
    }

    // Store AI response message if conversation exists
    if (conversation) {
      await prisma.message.create({
        data: {
          content: result.finalOutput || result,
          isUser: false,
          conversationId: conversation.id,
          model,
        },
      })

      // Re-fetch conversation messages after storing new messages
      conversation = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      })
    }

    // Return response with conversationId and messages if available
    const responsePayload = {
      ...result,
      conversationId: conversation ? conversation.id : null,
      messages: conversation ? conversation.messages : [],
    }

    console.log("Request processed successfully")
    return NextResponse.json(responsePayload)
  } catch (error) {
    console.error("API route error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
