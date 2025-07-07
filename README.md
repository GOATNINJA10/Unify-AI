# Unified AI Interface - Scira & DeepSeek Integration

A lightweight web-based interface that integrates Scira and DeepSeek APIs, allowing users to interact with both models seamlessly with automatic chaining capabilities.

## Features

- **Multi-Model Integration**: Seamlessly integrate with both Scira and DeepSeek R1 APIs
- **OpenRouter Integration**: Access DeepSeek R1 via OpenRouter's unified API
- **Automatic Chaining**: Output from one model automatically becomes input for the next
- **Flexible Processing Modes**: 
  - Chained Processing (Scira → DeepSeek R1)
  - Individual model processing (Scira only or DeepSeek R1 only)
- **Real-time Processing**: Live processing time tracking and visualization
- **Intuitive UI**: Clean, responsive interface inspired by modern AI platforms
- **Copy to Clipboard**: Easy copying of responses
- **Error Handling**: Robust error management and user feedback

## Tech Stack

- **Frontend**: Next.js 15 with React 19
- **Backend**: Next.js API Routes
- **AI Integration**: OpenRouter API for DeepSeek R1 access
- **UI Components**: Tailwind CSS with shadcn/ui
- **Icons**: Lucide React
- **Deployment**: Vercel-ready

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- OpenRouter API key (for DeepSeek R1 access)
  
### Installation

1. Clone the repository:
\`\`\`bash
git clone <repository-url>
cd unified-ai-interface
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
# or
pnpm install
\`\`\`

3. Set up environment variables:
\`\`\`bash
# Create .env.local file
\`\`\`
OPENROUTER_API_KEY=your_openrouter_api_key_here
SITE_URL=http://localhost:3000
\`\`\`

4. Run the development server:
\`\`\`bash
npm run dev
# or
pnpm dev
\`\`\`

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Integration

### DeepSeek R1 via OpenRouter

The application uses OpenRouter to access DeepSeek R1:

\`\`\`typescript
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.SITE_URL,
    "X-Title": "Unified AI Interface"
  },
  body: JSON.stringify({
    model: "deepseek/deepseek-r1:nitro",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2000,
    temperature: 0.7
  })
})
\`\`\`

### OpenRouter Setup

1. **Get API Key**: Sign up at [OpenRouter](https://openrouter.ai/) and get your API key
2. **Model Access**: DeepSeek R1 is available as `deepseek/deepseek-r1:nitro`
3. **Credits**: Ensure you have sufficient credits for API calls

### Scira Integration

The Scira integration is currently implemented as a mock. Replace the `callSciraAPI` function in `/app/api/ai-chat/route.ts` with your actual Scira API implementation:

\`\`\`typescript
async function callSciraAPI(prompt: string): Promise<string> {
  // Replace this with actual Scira API integration
  const response = await fetch('YOUR_SCIRA_API_ENDPOINT', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SCIRA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  })
  
  const data = await response.json()
  return data.response
}
\`\`\`

## Chaining Logic

The application implements intelligent chaining where:

1. **Step 1**: User query is processed by Scira
2. **Step 2**: Scira's output is combined with the original query and sent to DeepSeek R1
3. **Result**: DeepSeek R1 provides a refined, comprehensive response building on Scira's analysis

## Usage

1. **Select Processing Mode**:
   - **Chained Processing**: Uses both models in sequence
   - **Scira Only**: Uses only the Scira model
   - **DeepSeek R1 Only**: Uses only the DeepSeek R1 model via OpenRouter

2. **Enter Your Query**: Type your question or prompt in the text area

3. **Submit**: Click "Submit Query" to process your request

4. **View Results**: See individual model responses and processing times

5. **Copy Responses**: Use the copy button to copy any response to clipboard

## Environment Variables

Required environment variables:

\`\`\`env
OPENROUTER_API_KEY=your_openrouter_api_key
SITE_URL=http://localhost:3000
\`\`\`

### OpenRouter Configuration

- **API Key**: Get from [OpenRouter Dashboard](https://openrouter.ai/keys)
- **Model**: Uses `deepseek/deepseek-r1:nitro` for optimal performance
- **Referer**: Required for OpenRouter API calls
- **Credits**: Monitor usage in OpenRouter dashboard

## DeepSeek R1 Capabilities

DeepSeek R1 via OpenRouter excels at:
- **Complex Reasoning**: Multi-step logical analysis
- **Mathematical Problem Solving**: Advanced mathematical reasoning
- **Code Analysis**: Programming and technical problem solving
- **Scientific Reasoning**: Research and analytical tasks
- **Critical Thinking**: Analyzing and building upon existing responses

## Error Handling

The application includes comprehensive error handling:

- OpenRouter API failures
- Invalid input validation
- Network connectivity issues
- Model-specific errors
- User-friendly error messages with details

## Performance Optimization

- Efficient API request handling
- Processing time tracking
- Optimized UI rendering
- Responsive design for all devices
- Error recovery mechanisms

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard:
   - `OPENROUTER_API_KEY`
   - `SCIRA_API_KEY`
   - `SCIRA_API_URL`
   - `SITE_URL` (your deployed URL)
4. Deploy automatically

### Local Deployment

\`\`\`bash
npm run build
npm start
\`\`\`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is part of the NemHem AI internship assessment.

## Support

For issues and questions, please create an issue in the repository or contact the development team.

## OpenRouter Resources

- [OpenRouter Documentation](https://openrouter.ai/docs)
- [Model Pricing](https://openrouter.ai/models)
- [API Keys Management](https://openrouter.ai/keys)
- [Usage Dashboard](https://openrouter.ai/activity)
