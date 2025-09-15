# Voyager AI - Intelligent Travel Itinerary Generator

An intelligent platform that uses Generative AI to create bespoke, end-to-end travel itineraries in seconds.

## Project Structure

```
voyager.ai/
├── server/                    # Express.js Node.js Backend
│   ├── src/
│   │   ├── routes/           # API endpoints  
│   │   ├── services/         # Business logic & AI integration
│   │   ├── middleware/       # Auth middleware
│   │   └── index.js          # Express application
│   ├── package.json
│   └── .env (create this)
├── frontend/                  # Vite React Frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── app/              # Application components
│   │   ├── lib/              # Utility libraries
│   │   └── styles/           # CSS styles
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Technology Stack

- **Frontend**: React with Vite, Tailwind CSS, Framer Motion
- **Backend**: Node.js with Express.js
- **AI Integration**: Google Gemini API
- **Authentication**: Clerk (optional)
- **Deployment**: Ready for cloud deployment

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager
- Google Gemini API key (from [Google AI Studio](https://makersuite.google.com/app/apikey))

### Installation

1. **Clone and install dependencies:**
```bash
# Install root dependencies
npm install

# Install all dependencies (frontend and backend)
npm run install-all
```

2. **Set up environment variables:**

Create `server/.env`:
```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
CLIENT_ORIGIN=http://localhost:5173
CLERK_SECRET_KEY=your_clerk_secret_key_here  # Optional
```

Create `frontend/.env.local` (optional, for Clerk auth):
```env
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here
VITE_API_BASE=http://localhost:5000
```

3. **Start development servers:**
```bash
npm run dev
```

This command starts both the backend (port 5000) and frontend (port 5173) concurrently.

### Individual Server Management

**Backend only:**
```bash
npm run dev:server
```

**Frontend only:**
```bash  
npm run dev:frontend
```

## API Endpoints

- `GET /health` - Health check
- `GET /api/health` - API health check  
- `POST /api/chat` - Chat with AI assistant
- `POST /api/itinerary` - Generate travel itinerary
- `POST /api/suggest` - Get travel suggestions

## Features

- ✅ Beautiful space-themed animated UI
- ✅ Interactive chat interface with AI assistant
- ✅ Real-time travel itinerary generation
- ✅ Natural language processing for travel queries
- ✅ Responsive design with smooth animations
- ✅ Optional user authentication with Clerk
- ✅ Constellation animations and space effects
- ✅ Modern React components with TypeScript support

## Usage

1. **Access the application** at http://localhost:5173
2. **Begin your journey** by clicking the animated button
3. **Chat with the AI assistant** about your travel plans
4. **Get personalized itineraries** and travel recommendations
5. **Enjoy the immersive space-themed experience**

## Development

The project uses:
- **Concurrent development**: Both servers run simultaneously 
- **Hot reloading**: Changes are reflected immediately
- **Modern tooling**: Vite for fast builds, ESLint for code quality
- **Modular architecture**: Clean separation of concerns

## Environment Setup

### For Authentication (Optional)
Set up Clerk authentication:
1. Create a Clerk account at https://clerk.dev
2. Get your publishable and secret keys
3. Add them to the respective `.env` files

### For AI Features (Required)
1. Get a Gemini API key from Google AI Studio
2. Add it to `server/.env` as `GEMINI_API_KEY`

## Troubleshooting

**Port conflicts:**
- Backend uses port 5000
- Frontend uses port 5173
- Kill processes if needed: `npm run predev`

**Environment issues:**
- Ensure all `.env` files are properly configured
- Check that the Gemini API key is valid

### AI Usage and Quota Controls

To minimize API quota usage while keeping the experience rich, the server supports two environment-driven toggles:

- `CHAT_USE_AI` (default: `false`)
	- When `false`, the chat flow runs in a local-first deterministic mode on the server and does not call the AI during conversation. The assistant still guides users through the essential steps (doorstep vs destination, destination input, duration, dates, travelers, confirm, then generate).
	- Set to `true` only if you want AI-driven conversational turns during chat. Expect higher quota usage.

- `ITINERARY_USE_AI` (default: `true`)
	- When `true`, itinerary generation calls the AI once per unique trip input. Responses are cached in-memory to avoid repeated calls.
	- When `false`, the server generates a deterministic, non-AI itinerary as a fallback. Useful for demos, tests, or when conserving quota.

Suggested settings for development and demos with minimal quota:

```env
# server/.env
CHAT_USE_AI=false
ITINERARY_USE_AI=true  # set to false to completely avoid AI during generation
```

The server also caches itineraries in-memory keyed by a normalized trip signature. If you want a fresh generation for the same inputs, change one of the trip parameters (e.g., dates or destinations) or restart the server to clear the cache.

**Installation problems:**
```bash
# Clean install
rm -rf node_modules frontend/node_modules server/node_modules
npm run install-all
```

## Contributing

This project demonstrates modern full-stack development with:
- React/Vite frontend with advanced animations
- Express.js backend with clean API design  
- AI integration with Google Gemini
- Optional authentication with Clerk
- Production-ready architecture

The codebase follows best practices for scalability and maintainability.
