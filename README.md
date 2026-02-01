# HRRR Weather Visualization

Real-time HRRR (High-Resolution Rapid Refresh) weather data visualization with animated wind particles.

## Features

- **Animated Wind Particles** - Visualize wind speed and direction with flowing particles
- **Weather Variables** - Temperature, precipitation, cloud cover from S3-hosted tiles
- **Forecast Animation** - Scrub through forecast hours with instant transitions
- **Real-time Data** - Fetches latest HRRR model runs automatically

## Tech Stack

- **Next.js 15** - React framework
- **Mapbox GL JS** - WebGL-powered maps
- **react-map-gl** - React bindings for Mapbox
- **HRRR Data** - NOAA High-Resolution Rapid Refresh model

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local`:
```bash
cp .env.example .env.local
```

3. Add your Mapbox token to `.env.local`

4. Run development server:
```bash
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Public Mapbox access token |
| `MAPBOX_SECRET_TOKEN` | Secret token for tileset metadata (optional) |

## Data Sources

- **Wind Particles**: Mapbox tileset `onwaterllc.wind-hrrr-daily-two`
- **Weather Tiles**: S3-hosted raster tiles with latest HRRR data
- **Metadata**: `https://sat-data-container.s3.us-east-1.amazonaws.com/metadata/latest.json`

## Deployment

Deploy to Vercel:
```bash
vercel
```

Add environment variables in Vercel dashboard.
