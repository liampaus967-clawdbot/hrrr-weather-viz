import { useState, useEffect, useCallback, useRef } from 'react';

export interface WindData {
  imageData: ImageData;
  width: number;
  height: number;
  bounds: {
    west: number;
    east: number;
    south: number;
    north: number;
  };
  metadata: WindMetadata | null;
}

export interface WindMetadata {
  source_file: string;
  shape: number[];
  wind_encoding: {
    min: number;
    max: number;
    unit: string;
    r_channel: string;
    g_channel: string;
    b_channel: string;
    encoding: string;
  };
  bounds?: {
    west: number;
    east: number;
    south: number;
    north: number;
  };
}

interface UseWindDataOptions {
  baseUrl?: string;
  date?: string;
  cycle?: string;
  forecastHour?: string;
  enabled?: boolean;
}

// HRRR CONUS bounds (approximate)
const HRRR_BOUNDS = {
  west: -134.1,
  east: -60.9,
  south: 21.1,
  north: 52.6,
};

export function useWindData(options: UseWindDataOptions = {}) {
  const {
    baseUrl = 'https://driftwise-weather-data.s3.amazonaws.com/wind-tiles',
    date,
    cycle,
    forecastHour = '00',
    enabled = true,
  } = options;

  const [windData, setWindData] = useState<WindData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Decode wind component from 0-255 to m/s
  const decodeWindComponent = useCallback((encoded: number, min = -50, max = 50): number => {
    const normalized = encoded / 255;
    return normalized * (max - min) + min;
  }, []);

  const loadWindData = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      // Build URL - if no date specified, try to find latest
      let targetDate = date;
      let targetCycle = cycle;

      if (!targetDate || !targetCycle) {
        // Get latest available (approximately 3 hours ago)
        const now = new Date();
        now.setHours(now.getHours() - 3);
        targetDate = now.toISOString().split('T')[0];
        targetCycle = String(now.getUTCHours()).padStart(2, '0');
      }

      const pngUrl = `${baseUrl}/${targetDate}/${targetCycle}Z/wind_${targetDate.replace(/-/g, '')}_t${targetCycle}z_f${forecastHour}.png`;
      const jsonUrl = `${baseUrl}/${targetDate}/${targetCycle}Z/wind_${targetDate.replace(/-/g, '')}_t${targetCycle}z_f${forecastHour}.json`;

      // Load metadata
      let metadata: WindMetadata | null = null;
      try {
        const metaRes = await fetch(jsonUrl);
        if (metaRes.ok) {
          metadata = await metaRes.json();
        }
      } catch (e) {
        console.warn('Failed to load wind metadata:', e);
      }

      // Load PNG image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load wind image: ${pngUrl}`));
        img.src = pngUrl;
      });

      // Create canvas to extract pixel data
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);

      // Use bounds from metadata if available, otherwise use HRRR defaults
      const bounds = metadata?.bounds || HRRR_BOUNDS;

      setWindData({
        imageData,
        width: img.width,
        height: img.height,
        bounds,
        metadata,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error loading wind data';
      setError(message);
      console.error('Wind data load error:', err);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, date, cycle, forecastHour, enabled]);

  // Auto-load when parameters change
  useEffect(() => {
    loadWindData();
  }, [loadWindData]);

  // Helper to get wind vector at a given pixel coordinate
  const getWindAtPixel = useCallback((x: number, y: number): { u: number; v: number; magnitude: number } | null => {
    if (!windData) return null;
    
    const { imageData, width, height } = windData;
    const px = Math.floor(x);
    const py = Math.floor(y);
    
    if (px < 0 || px >= width || py < 0 || py >= height) return null;
    
    const idx = (py * width + px) * 4;
    const r = imageData.data[idx];     // U component
    const g = imageData.data[idx + 1]; // V component
    const b = imageData.data[idx + 2]; // Magnitude
    const a = imageData.data[idx + 3]; // Alpha (valid data mask)
    
    if (a === 0) return null; // No data at this location
    
    const u = decodeWindComponent(r);
    const v = decodeWindComponent(g);
    const magnitude = (b / 255) * 70.7; // Max magnitude ~70 m/s
    
    return { u, v, magnitude };
  }, [windData, decodeWindComponent]);

  // Helper to get wind at lat/lng
  const getWindAtLatLng = useCallback((lat: number, lng: number): { u: number; v: number; magnitude: number } | null => {
    if (!windData) return null;
    
    const { width, height, bounds } = windData;
    
    // Convert lat/lng to pixel coordinates
    const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * width;
    const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * height;
    
    return getWindAtPixel(x, y);
  }, [windData, getWindAtPixel]);

  return {
    windData,
    loading,
    error,
    refresh: loadWindData,
    getWindAtPixel,
    getWindAtLatLng,
  };
}

export default useWindData;
