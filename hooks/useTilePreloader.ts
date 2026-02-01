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
    // Preload a grid of tiles per forecast hour at the specified zoom level
    // Using a 5x5 grid for better coverage (25 tiles per forecast hour)
    const tilesToLoad: { url: string; forecastHour: string }[] = [];
    const gridSize = 5; // 5x5 grid = 25 tiles per forecast hour

    for (const forecastHour of forecastHours) {
      // Preload a grid of tiles centered on the center tile
      const startOffset = Math.floor(gridSize / 2); // e.g., 2 for 5x5 grid
      
      for (let dx = -startOffset; dx <= startOffset; dx++) {
        for (let dy = -startOffset; dy <= startOffset; dy++) {
          const tileUrl = urlTemplate
            .replace("{variable}", variable)
            .replace("{timestamp}", timestamp)
            .replace("{forecast}", forecastHour)
            .replace("{z}", String(zoomLevel))
            .replace("{x}", String(tileX + dx))
            .replace("{y}", String(tileY + dy));

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

    // Load tiles with limited concurrency (6 at a time)
    const concurrencyLimit = 6;
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
