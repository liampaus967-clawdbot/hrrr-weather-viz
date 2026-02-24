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
  metadata: LatestWindMetadata | null;
}

export interface LatestWindMetadata {
  model: string;
  model_run: {
    date: string;
    cycle: string;
    timestamp: string;
  };
  forecast_hours: number[];
  tiles: {
    base_url: string;
    filename_pattern: string;
    width: number;
    height: number;
  };
  encoding: {
    r_channel: string;
    g_channel: string;
    b_channel: string;
    min_value: number;
    max_value: number;
    zero_value: number;
  };
  bounds: {
    west: number;
    east: number;
    north: number;
    south: number;
  };
  generated_at: string;
}

interface UseWindDataOptions {
  metadataUrl?: string;
  forecastHour?: string;
  enabled?: boolean;
}

// HRRR CONUS bounds (fallback)
const HRRR_BOUNDS = {
  west: -134.1,
  east: -60.9,
  south: 21.1,
  north: 52.6,
};

export function useWindData(options: UseWindDataOptions = {}) {
  const {
    metadataUrl = 'https://driftwise-weather-data.s3.amazonaws.com/metadata/latest_wind.json',
    forecastHour = '00',
    enabled = true,
  } = options;

  const [windData, setWindData] = useState<WindData | null>(null);
  const [metadata, setMetadata] = useState<LatestWindMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Fetch latest metadata
  const fetchMetadata = useCallback(async (): Promise<LatestWindMetadata | null> => {
    try {
      const cacheBuster = `?_t=${Date.now()}`;
      const res = await fetch(metadataUrl + cacheBuster, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch metadata: ${res.status}`);
      }
      const data = await res.json();
      setMetadata(data);
      return data;
    } catch (e) {
      console.error('Failed to fetch latest_wind.json:', e);
      return null;
    }
  }, [metadataUrl]);

  // Load wind tile data
  const loadWindData = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch latest metadata first
      let meta = metadata;
      if (!meta) {
        meta = await fetchMetadata();
      }

      if (!meta) {
        throw new Error('Could not load wind metadata');
      }

      // Build tile URL from metadata
      const forecastNum = forecastHour.padStart(2, '0');
      const pngUrl = meta.tiles.base_url + '/' + 
        meta.tiles.filename_pattern.replace('{forecast}', forecastNum);

      console.log('Loading wind tile:', pngUrl);

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

      // Use bounds from metadata
      const bounds = meta.bounds || HRRR_BOUNDS;

      setWindData({
        imageData,
        width: img.width,
        height: img.height,
        bounds,
        metadata: meta,
      });

      console.log(`Wind data loaded: ${img.width}x${img.height}, forecast F${forecastNum}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error loading wind data';
      setError(message);
      console.error('Wind data load error:', err);
    } finally {
      setLoading(false);
    }
  }, [enabled, metadata, forecastHour, fetchMetadata]);

  // Auto-load when parameters change
  useEffect(() => {
    if (enabled) {
      loadWindData();
    }
  }, [enabled, forecastHour]);

  // Refresh metadata and reload
  const refresh = useCallback(async () => {
    setMetadata(null);
    await loadWindData();
  }, [loadWindData]);

  // Decode wind component from 0-255 to m/s
  const decodeWindComponent = useCallback((encoded: number, min = -50, max = 50): number => {
    const normalized = encoded / 255;
    return normalized * (max - min) + min;
  }, []);

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
    metadata,
    loading,
    error,
    refresh,
    getWindAtPixel,
    getWindAtLatLng,
    availableForecastHours: metadata?.forecast_hours || [],
  };
}

export default useWindData;
