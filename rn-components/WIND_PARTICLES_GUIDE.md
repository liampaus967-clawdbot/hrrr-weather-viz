# React Native Wind Particle Layer Guide

A complete guide to implementing animated wind particle visualization in React Native using `@shopify/react-native-skia` overlaid on `@rnmapbox/maps`.

## Overview

This implementation creates smooth, fading wind particle trails that:
- Animate based on real wind velocity data from HRRR weather model
- Scale particle density, speed, and trail length based on zoom level
- Use gradient fading (bright head → transparent tail)
- Overlay seamlessly on Mapbox maps

---

## Prerequisites

- React Native 0.70+
- Expo SDK 49+ (if using Expo)
- iOS 13+ / Android API 21+

---

## Installation

```bash
# Core dependencies
npm install @rnmapbox/maps @shopify/react-native-skia

# Required peer dependencies
npm install react-native-reanimated

# iOS only
cd ios && pod install
```

### Mapbox Setup

1. Create account at [mapbox.com](https://mapbox.com)
2. Get your public access token
3. Configure in your app:

```tsx
import MapboxGL from '@rnmapbox/maps';
MapboxGL.setAccessToken('pk.your_token_here');
```

### Skia Setup (Expo)

If using Expo, add to `app.json`:
```json
{
  "expo": {
    "plugins": ["@shopify/react-native-skia"]
  }
}
```

---

## S3 Wind Data Setup

### Data Format

Wind data is stored as PNG images where:
- **Red channel (R)**: U-component (east-west wind)
- **Green channel (G)**: V-component (north-south wind)
- **Alpha channel (A)**: Data mask (255 = valid data)

Values are encoded as: `pixel_value = (wind_speed_ms + 50) * 255 / 100`

This gives a range of -50 to +50 m/s mapped to 0-255.

### S3 Bucket Structure

```
s3://your-bucket/
├── wind/
│   ├── hrrr/
│   │   ├── conus/
│   │   │   ├── 2026022418/           # Model run: YYYYMMDDHH
│   │   │   │   ├── f00.png           # Forecast hour 00
│   │   │   │   ├── f01.png           # Forecast hour 01
│   │   │   │   ├── ...
│   │   │   │   └── f48.png           # Forecast hour 48
│   │   │   └── latest/
│   │   │       └── f00.png           # Symlink to latest
│   │   └── metadata.json
│   └── regions/
│       ├── northeast/
│       ├── southeast/
│       └── ...
└── metadata/
    └── hrrr_latest.json
```

### metadata.json Format

```json
{
  "model": "HRRR",
  "model_run": "2026-02-24T18:00:00Z",
  "forecast_hours": ["00", "01", "02", "..."],
  "bounds": {
    "west": -125.0,
    "east": -65.0,
    "north": 50.0,
    "south": 24.0
  },
  "width": 1799,
  "height": 1059,
  "encoding": {
    "type": "rgba_png",
    "u_channel": "red",
    "v_channel": "green",
    "scale": 100,
    "offset": 50,
    "units": "m/s"
  }
}
```

### S3 Bucket Policy (Public Read)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket/wind/*"
    }
  ]
}
```

### CORS Configuration

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

---

## Component Integration

### 1. Create the Wind Data Hook

```tsx
// hooks/useWindData.ts
import { useState, useEffect, useCallback } from 'react';
import { Image } from 'react-native';

export interface WindData {
  width: number;
  height: number;
  data: Uint8Array;
  bounds: {
    west: number;
    east: number;
    north: number;
    south: number;
  };
}

const S3_BASE_URL = 'https://your-bucket.s3.amazonaws.com';

export function useWindData(forecastHour: string = '00') {
  const [windData, setWindData] = useState<WindData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWindData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch metadata
      const metaResponse = await fetch(`${S3_BASE_URL}/wind/hrrr/metadata.json`);
      const metadata = await metaResponse.json();

      // Fetch wind PNG
      const imageUrl = `${S3_BASE_URL}/wind/hrrr/conus/latest/f${forecastHour}.png`;
      
      // Use canvas to decode PNG (React Native needs a polyfill or native module)
      // Option 1: Use react-native-image-colors or similar
      // Option 2: Fetch as base64 and decode
      // Option 3: Use a native module
      
      // For this example, we'll use a simplified approach
      // In production, you'd decode the actual PNG pixels
      
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      // Create wind data structure
      // NOTE: You'll need to implement actual PNG decoding here
      // This could use expo-image-manipulator, react-native-canvas, or a native module
      
      setWindData({
        width: metadata.width,
        height: metadata.height,
        data: new Uint8Array(metadata.width * metadata.height * 4), // Placeholder
        bounds: metadata.bounds,
      });

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch wind data');
      setLoading(false);
    }
  }, [forecastHour]);

  useEffect(() => {
    fetchWindData();
  }, [fetchWindData]);

  return { windData, loading, error, refresh: fetchWindData };
}
```

### 2. PNG Decoding Solution

For decoding PNG pixels in React Native, use one of these approaches:

#### Option A: expo-image-manipulator (Expo)

```tsx
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

async function decodePNG(imageUrl: string): Promise<Uint8Array> {
  // Download image
  const localUri = FileSystem.cacheDirectory + 'wind.png';
  await FileSystem.downloadAsync(imageUrl, localUri);
  
  // Get image data (requires custom native module for raw pixels)
  // expo-image-manipulator doesn't expose raw pixel data directly
  // You may need react-native-get-pixel-color or similar
}
```

#### Option B: Use Pre-processed JSON (Recommended)

Instead of decoding PNG on device, pre-process on server:

```json
// wind_data.json (gzipped)
{
  "width": 360,
  "height": 180,
  "bounds": { "west": -125, "east": -65, "north": 50, "south": 24 },
  "data": "base64_encoded_uint8array..."
}
```

```tsx
async function fetchWindJSON(url: string): Promise<WindData> {
  const response = await fetch(url);
  const json = await response.json();
  
  // Decode base64 to Uint8Array
  const binary = atob(json.data);
  const data = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    data[i] = binary.charCodeAt(i);
  }
  
  return {
    width: json.width,
    height: json.height,
    bounds: json.bounds,
    data,
  };
}
```

### 3. Main App Integration

```tsx
// App.tsx
import React, { useState, useRef, useCallback } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { SkiaWindParticles } from './components/SkiaWindParticles';
import { useWindData } from './hooks/useWindData';

MapboxGL.setAccessToken('pk.your_token_here');

export default function App() {
  const { width, height } = useWindowDimensions();
  const mapRef = useRef<MapboxGL.MapView>(null);
  
  const [camera, setCamera] = useState<{ zoom: number } | null>(null);
  const [mapBounds, setMapBounds] = useState<{
    ne: [number, number];
    sw: [number, number];
  } | null>(null);
  
  const { windData, loading } = useWindData('00');

  const handleCameraChanged = useCallback(async () => {
    if (!mapRef.current) return;
    
    try {
      const bounds = await mapRef.current.getVisibleBounds();
      const zoom = await mapRef.current.getZoom();
      
      setMapBounds({
        ne: bounds[0] as [number, number],
        sw: bounds[1] as [number, number],
      });
      setCamera({ zoom: zoom ?? 3 });
    } catch (e) {
      console.error(e);
    }
  }, []);

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Dark}
        onCameraChanged={handleCameraChanged}
        onMapIdle={handleCameraChanged}
      >
        <MapboxGL.Camera
          defaultSettings={{
            centerCoordinate: [-98, 39],
            zoomLevel: 4,
          }}
        />
      </MapboxGL.MapView>

      {/* Wind particle overlay */}
      <SkiaWindParticles
        windData={windData}
        mapCamera={camera}
        mapBounds={mapBounds}
        screenWidth={width}
        screenHeight={height}
        enabled={!loading && !!windData}
        baseParticleCount={2000}
        trailLength={12}
        maxAge={60}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
```

---

## Configuration Options

### SkiaWindParticles Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `windData` | `WindData \| null` | required | Wind velocity data |
| `mapCamera` | `{ zoom: number }` | required | Current map camera state |
| `mapBounds` | `{ ne, sw }` | required | Visible map bounds |
| `screenWidth` | `number` | required | Screen width in pixels |
| `screenHeight` | `number` | required | Screen height in pixels |
| `enabled` | `boolean` | `true` | Enable/disable animation |
| `baseParticleCount` | `number` | `2000` | Particles at zoom < 4 |
| `trailLength` | `number` | `15` | Max trail points |
| `maxAge` | `number` | `80` | Particle lifetime (frames) |

### Zoom-Based Scaling

The component automatically scales based on zoom level:

| Zoom | Particles | Speed | Trail Length |
|------|-----------|-------|--------------|
| < 4 | 100% | 100% | 100% |
| 4-6 | 50% | 75% | 80% |
| 6-8 | 20% | 38% | 60% |
| 8-10 | 8% | 19% | 40% |
| 10-12 | 4% | 8% | 25% |
| 12+ | 2.5% | 2.5% | 15% |

---

## Performance Tips

1. **Reduce particle count on older devices**
   ```tsx
   const isLowEnd = Platform.OS === 'android' && 
     parseInt(Platform.Version.toString()) < 28;
   const particleCount = isLowEnd ? 1000 : 2000;
   ```

2. **Disable during map gestures**
   ```tsx
   const [isGesturing, setIsGesturing] = useState(false);
   
   <MapboxGL.MapView
     onTouchStart={() => setIsGesturing(true)}
     onTouchEnd={() => setIsGesturing(false)}
   />
   
   <SkiaWindParticles enabled={!isGesturing} />
   ```

3. **Use lower resolution wind data for mobile**
   - Desktop: 1799 x 1059 (full HRRR)
   - Mobile: 360 x 212 (5x downsampled)

4. **Cache wind data**
   ```tsx
   import AsyncStorage from '@react-native-async-storage/async-storage';
   
   // Cache for 1 hour
   const cacheKey = `wind_${forecastHour}_${Date.now() / 3600000 | 0}`;
   ```

---

## Troubleshooting

### Particles not showing
- Check `mapBounds` is being set (add `console.log`)
- Verify wind data bounds overlap with map view
- Ensure `enabled={true}`

### Performance issues
- Reduce `baseParticleCount`
- Lower `trailLength`
- Decrease animation FPS (change `targetFPS` in component)

### Gradient not rendering
- Ensure head and tail positions are different
- Check Skia version compatibility

### Map interaction blocked
- Verify `pointerEvents="none"` on Canvas
- Check z-index of overlay

---

## File Structure

```
your-app/
├── components/
│   └── SkiaWindParticles.tsx    # Main particle component
├── hooks/
│   └── useWindData.ts           # Wind data fetching hook
├── utils/
│   └── windDecoder.ts           # PNG decoding utilities
└── App.tsx                      # Integration example
```

---

## Credits

- Wind data: NOAA HRRR Model
- Rendering: [@shopify/react-native-skia](https://shopify.github.io/react-native-skia/)
- Maps: [@rnmapbox/maps](https://github.com/rnmapbox/maps)

---

## License

MIT
