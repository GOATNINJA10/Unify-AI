# Unified AI Interface – Scira, DeepSeek R1 & Meta-LLaMA Integration

A unified web interface for interacting with multiple LLMs via Together AI and Scira. Features automatic chaining, markdown cleanup, and multi-model support.

---

## ✨ Features

- **Multi-Model Integration**:
  - Scira (via browser automation using Playwright)
  - DeepSeek R1 Distill LLaMA-70B (via Together AI)
  - Meta-LLaMA Models (e.g., LLaMA 3.3, LLaMA Vision)

- **Automatic Chaining**:
  - Combines Scira + DeepSeek R1 to refine and summarize responses

- **Flexible Modes**:
  - `scira`: Only Scira
  - `deepseek`: Only DeepSeek R1
  - `chained`: Scira → DeepSeek R1
  - `meta-llama/*`: Any Meta-LLaMA model via Together AI

- **LaTeX + Markdown Cleanup**:
  - Supports GFM, equations, references removal using `remark`

- **Error Handling & Timeout Management**:
  - Timeout detection for Scira scraping
  - Safe fallbacks and error messaging

- **Playwright Automation**:
  - Scira integration uses Chromium headless automation for interaction

---

## 🛠 Tech Stack

- **Frontend**: Next.js 15 + React 19
- **Backend**: API Routes (Next.js)
- **Markdown Processing**: `remark`, `remark-math`, `remark-gfm`
- **Headless Browser**: Playwright (Chromium)
- **UI**: Tailwind CSS + ShadCN/UI
- **Icons**: Lucide React

---

## 🚀 Getting Started

### 1. Clone + Install

```bash
git clone https://github.com/GOATNINJA10/Unify-AI
cd Unify-AI
npm install
# or
pnpm install
#and
npx playwright install

```
### 2. Environment Setup

Create .env.local:


```
TOGETHER_API_KEY=your_together_api_key

```
### 3. Run Dev Server

```
npm run dev

# or

pnpm dev

Visit: http://localhost:3000
```
### 🔗 Chaining Logic

When `chained` mode is selected:

1. User input is sent to **Scira**
2. Scira’s output is cleaned & processed (markdown, references, math)
3. The cleaned output is embedded into a structured prompt
4. That prompt is sent to **DeepSeek R1** via **Together AI**
5. Final response is returned

### 📦 API Summary
Endpoint
```

POST /api/ai-chat

```
Request

```
{
  "query": "Explain quantum tunneling",
  "model": "chained"
}
Supported model values
"scira"

"deepseek"

"chained"

"meta-llama/Llama-3.3-70B-Instruct-Turbo-Free"

"meta-llama/Llama-Vision-Free"
```
### 📄 Response Format
```

{
  "responses": [
    {
      "model": "scira",
      "response": "...",
      "timestamp": 1720425000000,
      "processingTime": 12430
    },
    {
      "model": "deepseek-r1",
      "response": "...",
      "timestamp": 1720425013000,
      "processingTime": 8350
    }
  ],
  "finalOutput": "...",
  "totalTime": 20780,
  "modelUsed": "deepseek-r1-distill-llama-70b",
  "via": "Together AI"
}
```
### 📐 Markdown Formatter

All outputs are cleaned and normalized:

- LaTeX support via `remark-math`
- GitHub-Flavored Markdown via `remark-gfm`
- Reference cleanup (e.g., `[1]`, `2\n`, etc.)
- Formatting rules enforced (bullets, indents, strong/emphasis)

---

### 🧪 Performance & Monitoring

- Real-time processing times
- Browser-controlled timeout for Scira
- Automatic retries if models fail
- Logs include length and response timing

---

### ⚠️ Troubleshooting

**Missing API Key:**

- Ensure `TOGETHER_API_KEY` is set in `.env.local`

**Scira Not Responding:**

- Check network stability and DOM selectors  
- Modify timeout values if site structure changes

**Playwright Errors:**

- Ensure Chromium is installed:

```bash
npx playwright install
```
### 🤝 Contributing

1. Fork this repo  
2. Create a branch: `feature/my-change`  
3. Add logic or UI improvements  
4. Create a PR


### 📄 License
This project is developed for the NemHem AI Internship Assessment and is subject to internal evaluation terms.
