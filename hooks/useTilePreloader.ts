/**
 * Tile Preloader Hook
 *
 * Preloads forecast hour tiles into browser cache using hidden Image elements.
 * This reduces loading delays during animation playback.
 *
 * Part of TICKET-014: Implement Forecast Hour Animation
 */

import { useState, useCallback, useRef, useEffect } from "react";

interface PreloadConfig {
  urlTemplate: string;
  variable: string;
  timestamp: string;
  forecastHours: string[];
  zoomLevel?: number;
  centerTile?: { x: number; y: number };
}

interface UseTilePreloaderResult {
  preloadTiles: () => Promise<void>;
  progress: number;
  isPreloading: boolean;
  preloadedHours: Set<string>;
  cancelPreload: () => void;
}

/**
 * Hook for preloading weather tiles for smooth animation
 */
export function useTilePreloader(config: PreloadConfig | null): UseTilePreloaderResult {
  const [progress, setProgress] = useState(0);
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadedHours, setPreloadedHours] = useState<Set<string>>(new Set());
  const cancelledRef = useRef(false);
  const imagesRef = useRef<HTMLImageElement[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      imagesRef.current.forEach((img) => {
        img.src = "";
      });
      imagesRef.current = [];
    };
  }, []);

  const cancelPreload = useCallback(() => {
    cancelledRef.current = true;
    setIsPreloading(false);
    imagesRef.current.forEach((img) => {
      img.src = "";
    });
    imagesRef.current = [];
  }, []);

  const preloadTiles = useCallback(async () => {
    if (!config || config.forecastHours.length === 0) {
      setProgress(100);
      return;
    }

    cancelledRef.current = false;
    setIsPreloading(true);
    setProgress(0);

    const { urlTemplate, variable, timestamp, forecastHours, zoomLevel = 5, centerTile } = config;

    // Generate representative tile coordinates
    // Default to center of CONUS if not specified
    const tileX = centerTile?.x ?? 7;
    const tileY = centerTile?.y ?? 12;

    // Build list of tiles to preload
    // Preload tiles covering the full CONUS extent at the specified zoom level
    // CONUS at zoom 5: X range ~4-10, Y range ~10-13 (about 28 tiles)
    // CONUS at zoom 4: X range ~2-5, Y range ~5-6 (about 8 tiles)
    const tilesToLoad: { url: string; forecastHour: string }[] = [];
    
    // Define CONUS tile bounds for different zoom levels
    const conusTileBounds: Record<number, { xMin: number; xMax: number; yMin: number; yMax: number }> = {
      3: { xMin: 1, xMax: 2, yMin: 2, yMax: 3 },
      4: { xMin: 2, xMax: 5, yMin: 5, yMax: 6 },
      5: { xMin: 4, xMax: 10, yMin: 10, yMax: 13 },
      6: { xMin: 9, xMax: 20, yMin: 20, yMax: 27 },
    };
    
    const bounds = conusTileBounds[zoomLevel] || conusTileBounds[5];

    for (const forecastHour of forecastHours) {
      // Load all tiles in the CONUS bounds at this zoom level
      for (let x = bounds.xMin; x <= bounds.xMax; x++) {
        for (let y = bounds.yMin; y <= bounds.yMax; y++) {
          const tileUrl = urlTemplate
            .replace("{variable}", variable)
            .replace("{timestamp}", timestamp)
            .replace("{forecast}", forecastHour)
            .replace("{z}", String(zoomLevel))
            .replace("{x}", String(x))
            .replace("{y}", String(y));

          tilesToLoad.push({ url: tileUrl, forecastHour });
        }
      }
    }

    let loaded = 0;
    const newPreloadedHours = new Set<string>();
    const loadPromises: Promise<void>[] = [];

    // Load tiles in parallel with a concurrency limit
    const loadTile = (tile: { url: string; forecastHour: string }): Promise<void> => {
      return new Promise((resolve) => {
        if (cancelledRef.current) {
          resolve();
          return;
        }

        const img = new Image();
        imagesRef.current.push(img);

        img.onload = () => {
          loaded++;
          newPreloadedHours.add(tile.forecastHour);
          setProgress(Math.round((loaded / tilesToLoad.length) * 100));
          resolve();
        };

        img.onerror = () => {
          loaded++;
          setProgress(Math.round((loaded / tilesToLoad.length) * 100));
          resolve();
        };

        img.src = tile.url;
      });
    };

    // Load tiles with limited concurrency (12 at a time for faster preloading)
    const concurrencyLimit = 12;
    for (let i = 0; i < tilesToLoad.length; i += concurrencyLimit) {
      if (cancelledRef.current) break;

      const batch = tilesToLoad.slice(i, i + concurrencyLimit);
      await Promise.all(batch.map(loadTile));
    }

    if (!cancelledRef.current) {
      setPreloadedHours(newPreloadedHours);
      setProgress(100);
    }

    setIsPreloading(false);
    imagesRef.current = [];
  }, [config]);

  return {
    preloadTiles,
    progress,
    isPreloading,
    preloadedHours,
    cancelPreload,
  };
}

export default useTilePreloader;
