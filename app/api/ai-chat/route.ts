import { type NextRequest, NextResponse } from "next/server"
import { chromium } from "playwright"

// Helper function to format the response in clean markdown
function formatResponse(response: string): string {
  // Clean up any markdown formatting issues
  let formatted = response
    // Remove reference numbers like "1\n" or "2\n" at the start of lines
    .replace(/^\s*\d+\s*\n/gm, '\n')
    // Remove citation markers like [1] or [2]
    .replace(/\s*\[\d+\]\s*/g, '')
    // Clean up extra spaces before newlines
    .replace(/\s+\n/g, '\n')
    // Fix common markdown table formatting issues
    .replace(/\|\s*\n\s*\|/g, '|\n|')
    // Limit consecutive newlines to 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Fix markdown tables by ensuring proper alignment rows
  if (formatted.includes('|') && formatted.includes('---')) {
    const lines = formatted.split('\n');
    let inTable = false;
    const fixedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this is a table header or separator
      if (line.trim().startsWith('|') && line.includes('---')) {
        inTable = true;
        // Ensure the separator line has the correct number of columns
        const headerLine = lines[i-1];
        const columnCount = (headerLine.match(/\|/g) || []).length - 1;
        const separator = '|' + ' --- |'.repeat(columnCount);
        fixedLines.push(separator);
        continue;
      } else if (inTable && line.trim() === '') {
        // End of table
        inTable = false;
        fixedLines.push('');
      }
      
      // Clean up table rows
      if (inTable) {
        // Ensure proper spacing around | characters
        const cleanLine = line
          .replace(/\s*\|\s*/g, ' | ')
          .replace(/^\s*\|/, '|')
          .replace(/\|\s*$/, '|')
          .replace(/\s+/g, ' ')
          .trim();
        fixedLines.push(cleanLine);
      } else {
        fixedLines.push(line);
      }
    }
    
    formatted = fixedLines.join('\n');
  }

  // Try to detect if the response contains a table or structured data
  if (formatted.includes('|') && formatted.includes('-|-')) {
    // If it already has markdown table formatting, leave it as is
    return formatted;
  }

  // Add basic markdown formatting for better readability
  const lines = formatted.split('\n');
  const formattedLines = [];
  let inList = false;
  let inTable = false;
  let tableRows: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines at the beginning
    if (formattedLines.length === 0 && !line) continue;
    
    // Handle bullet points
    if (line.match(/^•\s+|^\d+\.\s+/)) {
      if (!inList) {
        inList = true;
      }
      formattedLines.push(line);
      continue;
    } else if (inList) {
      inList = false;
      formattedLines.push('');
    }
    
    // Handle potential table data
    if (line.includes(':')) {
      const parts = line.split(':');
      if (parts.length === 2 && parts[1].trim()) {
        formattedLines.push(`**${parts[0].trim()}:** ${parts[1].trim()}`);
        continue;
      }
    }
    
    // Add the line as is if no special formatting applies
    if (line) {
      formattedLines.push(line);
    }
  }

  // Join lines with proper spacing
  formatted = formattedLines.join('\n');

  // Add markdown headers if the response is long enough
  const lineCount = formatted.split('\n').length;
  if (lineCount > 10 && !formatted.startsWith('#')) {
    // Find the first line that could be a title (longest line in first 5 lines)
    const firstLines = formatted.split('\n').slice(0, 5);
    const titleLine = firstLines
      .filter(line => !line.startsWith('|') && !line.includes('---'))
      .reduce((longest, line) => {
        const cleanLine = line.replace(/[#*_`~]/g, '').trim();
        return cleanLine.length > longest.length ? cleanLine : longest;
      }, '');
    
    if (titleLine.length > 10 && titleLine.length < 100) {
      formatted = `# ${titleLine}\n\n${formatted.replace(titleLine, '').trim()}`;
    }
  }
  
  // Ensure proper spacing around headers and paragraphs
  formatted = formatted
    .replace(/(#+)([^\n])/g, '$1 $2')
    .replace(/([^\n])\n([^\n])/g, '$1\n\n$2');

  return formatted;
}

// Together AI API for DeepSeek R1
async function callDeepSeekR1API(prompt: string): Promise<string> {
  console.log("Calling Together AI's DeepSeek R1 Distill Llama 70B with prompt length:", prompt.length);

  try {
    const API_KEY = process.env.TOGETHER_API_KEY;
    if (!API_KEY) {
      throw new Error("Together API key not found. Please set the TOGETHER_API_KEY environment variable.");
    }

    const model = "deepseek-ai/deepseek-r1-distill-llama-70b";
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
      completion = completion.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      
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
    const systemPrompt = `You are DeepSeek R1, an advanced AI assistant. Your task is to summarize and refine the following response in a clear, concise manner.`
    
    const chainedPrompt = `## Original User Query
${query}

## Initial Response from Scira
${sciraResponse}

## Your Task
Please provide a concise and well-structured summary that:
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

export async function POST(request: NextRequest) {
  console.log("API route called")

  try {
    const body = await request.json()
    console.log("Request body:", body)

    const { query, model } = body

    if (!query || typeof query !== "string") {
      console.error("Invalid query:", query)
      return NextResponse.json({ error: "Query is required and must be a string" }, { status: 400 })
    }

    if (!model || !["scira", "deepseek", "chained"].includes(model)) {
      console.error("Invalid model:", model)
      return NextResponse.json({ error: "Valid model selection is required" }, { status: 400 })
    }

    // Check if Together AI API key is configured
    if (!process.env.TOGETHER_API_KEY) {
      console.error("TOGETHER API key not configured")
      return NextResponse.json({ error: "TOGETHER API key not configured" }, { status: 500 })
    }

    console.log("Processing request with model:", model)
    let result

    if (model === "chained") {
      result = await processChainedRequest(query)
    } else {
      result = await processSingleModel(query, model as "scira" | "deepseek")
    }

    console.log("Request processed successfully")
    return NextResponse.json(result)
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
