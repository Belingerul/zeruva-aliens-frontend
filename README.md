# Alien Expedition - Roulette MVP

A responsive, mobile-first roulette game where you spin alien eggs to win different alien creatures.

## Features

- 🎰 Roulette-style spin animation with smooth easing
- 🥚 Three egg types: Basic, Rare, and Ultra
- 👽 Dynamic alien images fetched from API
- 🌈 Rarity tiers with color-coded glows (Common, Rare, Epic, Legendary)
- 📱 Fully responsive design (mobile-first)
- ✨ Neon-themed UI with deep black background

## Tech Stack

- React 18
- Vite
- TypeScript
- Tailwind CSS
- Framer Motion
- Axios

## Setup

1. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Configure API URL (optional):**
   
   Create a `.env` file in the root directory:
   \`\`\`
   VITE_API_URL=https://zeruva-backend-production.up.railway.app/api
   \`\`\`
   
   If not set, the app defaults to the Railway API URL.

3. **Run the development server:**
   \`\`\`bash
   npm run dev
   \`\`\`

4. **Build for production:**
   \`\`\`bash
   npm run build
   \`\`\`

## How It Works

1. Click one of the egg buttons (Basic, Rare, or Ultra)
2. The app fetches 16 random aliens and sends a spin request to the server
3. A roulette modal appears with the aliens scrolling under a center indicator
4. After 3-4.8 seconds, the roulette stops on the winning alien
5. The alien's rarity tier and ROI are displayed with color-coded effects

## API Endpoints

- `GET /get-random-aliens?count=16` - Fetches random alien images
- `POST /spin` - Spins with `{ eggType: 'Basic' | 'Rare' | 'Ultra' }`
- `POST /buy-spaceship` - Future feature (stub only)

## Color Coding

- **Common**: Green glow
- **Rare**: Blue glow
- **Epic**: Purple glow
- **Legendary**: Gold glow

## Future Features

- Phantom wallet integration for spaceship purchases
- Inventory system for collected aliens
- Leaderboard and statistics
