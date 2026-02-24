/**
 * SkiaWindParticles - React Native wind particle visualization
 * Uses react-native-skia overlay on top of @rnmapbox/maps
 * 
 * Install deps:
 *   npm install @shopify/react-native-skia react-native-reanimated
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { StyleSheet, View, PixelRatio } from 'react-native';
import {
  Canvas,
  Path,
  Skia,
  LinearGradient,
  vec,
  useValue,
  useComputedValue,
  runTiming,
} from '@shopify/react-native-skia';
import type { SkPath } from '@shopify/react-native-skia';
import type { Camera } from '@rnmapbox/maps';

interface WindData {
  // Grid dimensions
  width: number;
  height: number;
  // Wind components as Uint8Array (RGBA encoded)
  data: Uint8Array;
  // Geographic bounds
  bounds: {
    west: number;
    east: number;
    north: number;
    south: number;
  };
}

interface Particle {
  id: number;
  x: number; // pixel position in wind grid
  y: number;
  lng: number;
  lat: number;
  age: number;
  maxAge: number;
  trail: { lng: number; lat: number }[];
}

interface SkiaWindParticlesProps {
  windData: WindData | null;
  mapCamera: Camera | null;
  mapBounds: { ne: [number, number]; sw: [number, number] } | null;
  screenWidth: number;
  screenHeight: number;
  enabled?: boolean;
  baseParticleCount?: number;
  trailLength?: number;
  maxAge?: number;
  color?: string;
  fadeColor?: string;
}

// Convert lat/lng to screen coordinates
function projectToScreen(
  lng: number,
  lat: number,
  mapBounds: { ne: [number, number]; sw: [number, number] },
  screenWidth: number,
  screenHeight: number
): { x: number; y: number } | null {
  const [neLng, neLat] = mapBounds.ne;
  const [swLng, swLat] = mapBounds.sw;

  // Check if point is in view
  if (lng < swLng || lng > neLng || lat < swLat || lat > neLat) {
    return null;
  }

  const x = ((lng - swLng) / (neLng - swLng)) * screenWidth;
  const y = ((neLat - lat) / (neLat - swLat)) * screenHeight;

  return { x, y };
}

// Get particle count based on zoom
function getParticleCount(zoom: number, baseCount: number): number {
  if (zoom < 4) return baseCount;
  if (zoom < 6) return Math.floor(baseCount * 0.5);
  if (zoom < 8) return Math.floor(baseCount * 0.2);
  if (zoom < 10) return Math.floor(baseCount * 0.08);
  if (zoom < 12) return Math.floor(baseCount * 0.04);
  return Math.floor(baseCount * 0.025);
}

// Get speed factor based on zoom
function getSpeedFactor(zoom: number): number {
  if (zoom < 4) return 0.08;
  if (zoom < 6) return 0.06;
  if (zoom < 8) return 0.03;
  if (zoom < 10) return 0.015;
  if (zoom < 12) return 0.006;
  return 0.002;
}

// Get trail length based on zoom
function getTrailLength(zoom: number, baseLength: number): number {
  if (zoom < 4) return baseLength;
  if (zoom < 6) return Math.floor(baseLength * 0.8);
  if (zoom < 8) return Math.floor(baseLength * 0.6);
  if (zoom < 10) return Math.floor(baseLength * 0.4);
  if (zoom < 12) return Math.floor(baseLength * 0.25);
  return Math.max(3, Math.floor(baseLength * 0.15));
}

// Color scale for wind speed
const COLOR_SCALE = [
  [100, 200, 255], // slow - cyan
  [50, 150, 255],  // blue
  [0, 200, 255],   // bright blue
  [0, 255, 200],   // turquoise
  [0, 255, 100],   // green
  [255, 200, 0],   // yellow
  [255, 120, 0],   // orange
  [255, 50, 50],   // red
];

function getColorForSpeed(magnitude: number): string {
  const maxSpeed = 40;
  const normalized = Math.min(magnitude / maxSpeed, 1);
  const index = Math.min(
    Math.floor(normalized * (COLOR_SCALE.length - 1)),
    COLOR_SCALE.length - 1
  );
  const [r, g, b] = COLOR_SCALE[index];
  return `rgb(${r}, ${g}, ${b})`;
}

export function SkiaWindParticles({
  windData,
  mapCamera,
  mapBounds,
  screenWidth,
  screenHeight,
  enabled = true,
  baseParticleCount = 2000,
  trailLength = 15,
  maxAge = 80,
  color = 'cyan',
  fadeColor = 'transparent',
}: SkiaWindParticlesProps) {
  const particlesRef = useRef<Particle[]>([]);
  const [paths, setPaths] = useState<{ path: SkPath; headColor: string; tailColor: string }[]>([]);
  const animationRef = useRef<number | null>(null);
  const zoom = mapCamera?.zoom ?? 3;

  // Initialize particles
  const initParticles = useCallback(() => {
    if (!windData || !mapBounds) return;

    const { width, height, bounds } = windData;
    const particleCount = getParticleCount(zoom, baseParticleCount);
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const lng = bounds.west + Math.random() * (bounds.east - bounds.west);
      const lat = bounds.south + Math.random() * (bounds.north - bounds.south);
      const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * width;
      const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * height;

      particles.push({
        id: i,
        x,
        y,
        lng,
        lat,
        age: Math.floor(Math.random() * maxAge),
        maxAge: maxAge + Math.floor(Math.random() * 30) - 15,
        trail: [{ lng, lat }],
      });
    }

    particlesRef.current = particles;
  }, [windData, mapBounds, zoom, baseParticleCount, maxAge]);

  // Update particles
  const updateParticles = useCallback(() => {
    if (!windData || !mapBounds) return;

    const { data, width, height, bounds } = windData;
    const particles = particlesRef.current;
    const speedFactor = getSpeedFactor(zoom);
    const currentTrailLength = getTrailLength(zoom, trailLength);

    particles.forEach((particle) => {
      const px = Math.floor(particle.x);
      const py = Math.floor(particle.y);

      if (px >= 0 && px < width && py >= 0 && py < height) {
        const idx = (py * width + px) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const a = data[idx + 3];

        if (a > 0) {
          // Decode wind components
          const u = (r / 255) * 100 - 50;
          const v = (g / 255) * 100 - 50;

          // Update position
          particle.x += u * speedFactor;
          particle.y -= v * speedFactor;

          // Update lat/lng
          particle.lng = bounds.west + (particle.x / width) * (bounds.east - bounds.west);
          particle.lat = bounds.north - (particle.y / height) * (bounds.north - bounds.south);

          // Add to trail
          particle.trail.unshift({ lng: particle.lng, lat: particle.lat });
          if (particle.trail.length > currentTrailLength) {
            particle.trail = particle.trail.slice(0, currentTrailLength);
          }
        }
      }

      particle.age++;

      // Reset if needed
      if (
        particle.age > particle.maxAge ||
        particle.x < 0 || particle.x >= width ||
        particle.y < 0 || particle.y >= height
      ) {
        const lng = bounds.west + Math.random() * (bounds.east - bounds.west);
        const lat = bounds.south + Math.random() * (bounds.north - bounds.south);
        particle.x = ((lng - bounds.west) / (bounds.east - bounds.west)) * width;
        particle.y = ((bounds.north - lat) / (bounds.north - bounds.south)) * height;
        particle.lng = lng;
        particle.lat = lat;
        particle.age = 0;
        particle.maxAge = maxAge + Math.floor(Math.random() * 30) - 15;
        particle.trail = [{ lng, lat }];
      }
    });
  }, [windData, mapBounds, zoom, trailLength, maxAge]);

  // Build Skia paths
  const buildPaths = useCallback(() => {
    if (!mapBounds) return;

    const particles = particlesRef.current;
    const newPaths: { path: SkPath; headColor: string; tailColor: string }[] = [];

    particles.forEach((p) => {
      if (p.trail.length < 2) return;

      const path = Skia.Path.Make();
      let started = false;
      let headPos: { x: number; y: number } | null = null;
      let tailPos: { x: number; y: number } | null = null;

      p.trail.forEach((point, i) => {
        const screen = projectToScreen(
          point.lng,
          point.lat,
          mapBounds,
          screenWidth,
          screenHeight
        );

        if (screen) {
          if (!started) {
            path.moveTo(screen.x, screen.y);
            headPos = screen;
            started = true;
          } else {
            path.lineTo(screen.x, screen.y);
            tailPos = screen;
          }
        }
      });

      if (started && headPos && tailPos) {
        // Get wind speed for color
        const magnitude = Math.sqrt(
          Math.pow(p.trail[0].lng - p.trail[1].lng, 2) +
          Math.pow(p.trail[0].lat - p.trail[1].lat, 2)
        ) * 1000;
        
        newPaths.push({
          path,
          headColor: getColorForSpeed(magnitude * 10),
          tailColor: 'transparent',
        });
      }
    });

    setPaths(newPaths);
  }, [mapBounds, screenWidth, screenHeight]);

  // Initialize on mount and when wind data changes
  useEffect(() => {
    if (enabled && windData && mapBounds) {
      initParticles();
    }
  }, [enabled, windData, mapBounds, initParticles]);

  // Animation loop
  useEffect(() => {
    if (!enabled || !windData || !mapBounds) {
      setPaths([]);
      return;
    }

    let lastTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    const animate = (currentTime: number) => {
      if (currentTime - lastTime >= frameInterval) {
        updateParticles();
        buildPaths();
        lastTime = currentTime;
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled, windData, mapBounds, updateParticles, buildPaths]);

  if (!enabled || paths.length === 0) {
    return null;
  }

  return (
    <Canvas style={[StyleSheet.absoluteFill, styles.canvas]} pointerEvents="none">
      {paths.map((p, i) => (
        <Path
          key={i}
          path={p.path}
          style="stroke"
          strokeWidth={2}
          strokeCap="round"
          strokeJoin="round"
          color={p.headColor}
          opacity={0.8}
        />
      ))}
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default SkiaWindParticles;
