/**
 * Double-Buffered Raster Layer Hook
 *
 * Provides perfectly smooth transitions between raster tile sets by maintaining
 * two layers (A and B) and crossfading between them. The new layer is only shown
 * once its tiles are fully loaded, eliminating any flickering.
 *
 * Technique:
 * 1. Layer A is visible with opacity 1
 * 2. User changes forecast hour
 * 3. Layer B loads new tiles (hidden, opacity 0)
 * 4. Once Layer B tiles are loaded, crossfade A→0, B→1
 * 5. Layer B is now the "active" layer
 * 6. On next change, roles swap: A loads new tiles, crossfade B→0, A→1
 */

import { useRef, useCallback, useState, useEffect } from "react";
import type { MapRef } from "react-map-gl";
import type mapboxgl from "mapbox-gl";

interface RasterSourceConfig {
  tileSize?: number;
  minzoom?: number;
  maxzoom?: number;
  bounds?: [number, number, number, number];
}

interface UseDoubleBufferedRasterLayerOptions {
  mapRef: React.RefObject<MapRef>;
  sourceConfig: RasterSourceConfig;
  baseOpacity?: number;
  crossfadeDuration?: number;
}

interface UseDoubleBufferedRasterLayerResult {
  /** Call this to transition to a new tile URL */
  transitionToTiles: (tileUrl: string) => void;
  /** Initialize the double-buffered system (call once on map load) */
  initialize: (initialTileUrl: string) => void;
  /** Current loading state */
  isTransitioning: boolean;
  /** Currently active layer ('A' or 'B') */
  activeLayer: "A" | "B";
  /** Clean up sources and layers */
  cleanup: () => void;
  /** Set opacity for both layers */
  setOpacity: (opacity: number) => void;
}

const SOURCE_A = "weather-tiles-A";
const SOURCE_B = "weather-tiles-B";
const LAYER_A = "weather-raster-layer-A";
const LAYER_B = "weather-raster-layer-B";

export function useDoubleBufferedRasterLayer(
  options: UseDoubleBufferedRasterLayerOptions
): UseDoubleBufferedRasterLayerResult {
  const { mapRef, sourceConfig, baseOpacity = 0.7, crossfadeDuration = 400 } = options;

  const activeLayerRef = useRef<"A" | "B">("A");
  const [activeLayer, setActiveLayer] = useState<"A" | "B">("A");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isInitializedRef = useRef(false);
  const pendingTransitionRef = useRef<string | null>(null);
  const opacityRef = useRef(baseOpacity);
  const animationFrameRef = useRef<number | null>(null);

  // Track current tile URLs to prevent duplicate transitions
  const currentTilesRef = useRef<{ A: string | null; B: string | null }>({
    A: null,
    B: null,
  });

  const getMap = useCallback(() => mapRef.current?.getMap(), [mapRef]);

  const cleanup = useCallback(() => {
    const map = getMap();
    if (!map) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Remove layers first
    if (map.getLayer(LAYER_A)) map.removeLayer(LAYER_A);
    if (map.getLayer(LAYER_B)) map.removeLayer(LAYER_B);

    // Then remove sources
    if (map.getSource(SOURCE_A)) map.removeSource(SOURCE_A);
    if (map.getSource(SOURCE_B)) map.removeSource(SOURCE_B);

    isInitializedRef.current = false;
    currentTilesRef.current = { A: null, B: null };
  }, [getMap]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const setOpacity = useCallback(
    (opacity: number) => {
      opacityRef.current = opacity;
      const map = getMap();
      if (!map) return;

      const activeId = activeLayerRef.current === "A" ? LAYER_A : LAYER_B;
      if (map.getLayer(activeId)) {
        map.setPaintProperty(activeId, "raster-opacity", opacity);
      }
    },
    [getMap]
  );

  const initialize = useCallback(
    (initialTileUrl: string) => {
      const map = getMap();
      if (!map || isInitializedRef.current) return;

      // Clean up any existing layers/sources first
      cleanup();

      const { tileSize = 256, minzoom = 0, maxzoom = 8, bounds } = sourceConfig;

      // Create Source A (will be visible)
      map.addSource(SOURCE_A, {
        type: "raster",
        tiles: [initialTileUrl],
        tileSize,
        minzoom,
        maxzoom,
        ...(bounds && { bounds }),
      });

      // Create Source B (will be hidden initially)
      // Use a placeholder - it will be updated when needed
      map.addSource(SOURCE_B, {
        type: "raster",
        tiles: [initialTileUrl],
        tileSize,
        minzoom,
        maxzoom,
        ...(bounds && { bounds }),
      });

      // Create Layer A (visible)
      map.addLayer({
        id: LAYER_A,
        type: "raster",
        source: SOURCE_A,
        paint: {
          "raster-opacity": opacityRef.current,
          "raster-fade-duration": 0, // We handle fading ourselves
        },
      });

      // Create Layer B (hidden)
      map.addLayer({
        id: LAYER_B,
        type: "raster",
        source: SOURCE_B,
        paint: {
          "raster-opacity": 0,
          "raster-fade-duration": 0,
        },
      });

      currentTilesRef.current = { A: initialTileUrl, B: initialTileUrl };
      activeLayerRef.current = "A";
      setActiveLayer("A");
      isInitializedRef.current = true;
    },
    [getMap, sourceConfig, cleanup]
  );

  const animateCrossfade = useCallback(
    (fromLayer: "A" | "B", toLayer: "A" | "B") => {
      const map = getMap();
      if (!map) return;

      const fromLayerId = fromLayer === "A" ? LAYER_A : LAYER_B;
      const toLayerId = toLayer === "A" ? LAYER_A : LAYER_B;
      const targetOpacity = opacityRef.current;

      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / crossfadeDuration, 1);

        // Ease in-out curve for smooth animation
        const eased =
          progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const fromOpacity = targetOpacity * (1 - eased);
        const toOpacity = targetOpacity * eased;

        if (map.getLayer(fromLayerId)) {
          map.setPaintProperty(fromLayerId, "raster-opacity", fromOpacity);
        }
        if (map.getLayer(toLayerId)) {
          map.setPaintProperty(toLayerId, "raster-opacity", toOpacity);
        }

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete - ensure final values are set
          if (map.getLayer(fromLayerId)) {
            map.setPaintProperty(fromLayerId, "raster-opacity", 0);
          }
          if (map.getLayer(toLayerId)) {
            map.setPaintProperty(toLayerId, "raster-opacity", targetOpacity);
          }

          activeLayerRef.current = toLayer;
          setActiveLayer(toLayer);
          setIsTransitioning(false);

          // Check if there's a pending transition
          if (pendingTransitionRef.current) {
            const pending = pendingTransitionRef.current;
            pendingTransitionRef.current = null;
            // Use setTimeout to prevent stack overflow with rapid changes
            setTimeout(() => transitionToTiles(pending), 0);
          }
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    },
    [getMap, crossfadeDuration]
  );

  const transitionToTiles = useCallback(
    (tileUrl: string) => {
      const map = getMap();
      if (!map || !isInitializedRef.current) return;

      // If same as currently active tiles, ignore
      const currentActive = activeLayerRef.current;
      if (currentTilesRef.current[currentActive] === tileUrl) {
        return;
      }

      // If already transitioning, queue this transition
      if (isTransitioning) {
        pendingTransitionRef.current = tileUrl;
        return;
      }

      setIsTransitioning(true);

      // Determine which layer to load into (the inactive one)
      const targetLayer = currentActive === "A" ? "B" : "A";
      const targetSourceId = targetLayer === "A" ? SOURCE_A : SOURCE_B;
      const targetSource = map.getSource(targetSourceId) as mapboxgl.RasterTileSource;

      if (!targetSource) {
        setIsTransitioning(false);
        return;
      }

      // Update the hidden layer's tiles
      currentTilesRef.current[targetLayer] = tileUrl;
      targetSource.setTiles([tileUrl]);

      // Wait for tiles to load before crossfading
      const checkLoaded = () => {
        if (!map.isSourceLoaded(targetSourceId)) {
          // Not loaded yet, check again on next sourcedata event
          return false;
        }
        return true;
      };

      // If already loaded (cached), crossfade immediately
      if (checkLoaded()) {
        animateCrossfade(currentActive, targetLayer);
        return;
      }

      // Listen for source load completion
      const onSourceData = (e: mapboxgl.MapSourceDataEvent) => {
        if (e.sourceId === targetSourceId && e.isSourceLoaded) {
          map.off("sourcedata", onSourceData);
          animateCrossfade(currentActive, targetLayer);
        }
      };

      map.on("sourcedata", onSourceData);

      // Timeout fallback - if tiles don't load in 5 seconds, crossfade anyway
      setTimeout(() => {
        map.off("sourcedata", onSourceData);
        if (isTransitioning) {
          animateCrossfade(currentActive, targetLayer);
        }
      }, 5000);
    },
    [getMap, isTransitioning, animateCrossfade]
  );

  return {
    transitionToTiles,
    initialize,
    isTransitioning,
    activeLayer,
    cleanup,
    setOpacity,
  };
}

export default useDoubleBufferedRasterLayer;
