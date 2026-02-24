'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { PathLayer } from '@deck.gl/layers';
import type { MapRef } from 'react-map-gl';
import type { WindData } from '@/hooks/useWindData';

interface Particle {
  id: number;
  x: number;
  y: number;
  age: number;
  maxAge: number;
  trail: { lng: number; lat: number; age: number }[];
}

interface DeckWindParticleLayerProps {
  mapRef: React.RefObject<MapRef>;
  windData: WindData | null;
  enabled?: boolean;
  particleCount?: number;
  lineWidth?: number;
  speedFactor?: number;
  trailLength?: number;
  maxAge?: number;
  opacity?: number;
}

// Smoother color scale for wind speed (m/s) - more muted/aesthetic
const COLOR_SCALE: [number, number, number][] = [
  [100, 180, 200],  // 0-5 m/s - soft cyan
  [120, 200, 180],  // 5-10 m/s - teal
  [160, 210, 160],  // 10-15 m/s - soft green
  [200, 220, 140],  // 15-20 m/s - lime
  [230, 210, 120],  // 20-25 m/s - gold
  [240, 180, 100],  // 25-30 m/s - orange
  [240, 140, 90],   // 30-35 m/s - coral
  [230, 100, 80],   // 35-40 m/s - salmon
  [210, 70, 70],    // 40-45 m/s - red
  [180, 50, 60],    // 45+ m/s - dark red
];

function getColorForMagnitude(magnitude: number): [number, number, number] {
  const maxSpeed = 40;
  const normalized = Math.min(magnitude / maxSpeed, 1);
  const index = Math.min(Math.floor(normalized * (COLOR_SCALE.length - 1)), COLOR_SCALE.length - 1);
  return COLOR_SCALE[index];
}

export function DeckWindParticleLayer({
  mapRef,
  windData,
  enabled = true,
  particleCount = 4000,
  lineWidth = 1.5,
  speedFactor = 0.08, // Much slower
  trailLength = 15,
  maxAge = 80,
  opacity = 0.7,
}: DeckWindParticleLayerProps) {
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize particles
  const initParticles = useCallback(() => {
    if (!windData) return;

    const { width, height, bounds } = windData;
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const lng = bounds.west + (x / width) * (bounds.east - bounds.west);
      const lat = bounds.north - (y / height) * (bounds.north - bounds.south);

      particles.push({
        id: i,
        x,
        y,
        age: Math.floor(Math.random() * maxAge),
        maxAge: maxAge + Math.floor(Math.random() * 30) - 15,
        trail: [{ lng, lat, age: 0 }],
      });
    }

    particlesRef.current = particles;
  }, [windData, particleCount, maxAge]);

  // Update particle positions based on wind field
  const updateParticles = useCallback(() => {
    if (!windData) return;

    const { imageData, width, height, bounds } = windData;
    const particles = particlesRef.current;

    particles.forEach((particle) => {
      // Get wind at current position
      const px = Math.floor(particle.x);
      const py = Math.floor(particle.y);

      if (px >= 0 && px < width && py >= 0 && py < height) {
        const idx = (py * width + px) * 4;
        const r = imageData.data[idx];
        const g = imageData.data[idx + 1];
        const a = imageData.data[idx + 3];

        if (a > 0) {
          // Decode wind components
          const u = ((r / 255) * 100 - 50);
          const v = ((g / 255) * 100 - 50);

          // Update position with slower speed
          particle.x += u * speedFactor;
          particle.y -= v * speedFactor;

          // Calculate new lat/lng
          const lng = bounds.west + (particle.x / width) * (bounds.east - bounds.west);
          const lat = bounds.north - (particle.y / height) * (bounds.north - bounds.south);

          // Add to trail with age tracking
          particle.trail.unshift({ lng, lat, age: 0 });
          
          // Age all trail points
          particle.trail.forEach(p => p.age++);
          
          // Trim trail
          if (particle.trail.length > trailLength) {
            particle.trail = particle.trail.slice(0, trailLength);
          }
        }
      }

      // Age particle
      particle.age++;

      // Reset if too old or out of bounds
      if (
        particle.age > particle.maxAge ||
        particle.x < 0 || particle.x >= width ||
        particle.y < 0 || particle.y >= height
      ) {
        // Respawn at random position
        particle.x = Math.random() * width;
        particle.y = Math.random() * height;
        const lng = bounds.west + (particle.x / width) * (bounds.east - bounds.west);
        const lat = bounds.north - (particle.y / height) * (bounds.north - bounds.south);
        particle.age = 0;
        particle.maxAge = maxAge + Math.floor(Math.random() * 30) - 15;
        particle.trail = [{ lng, lat, age: 0 }];
      }
    });
  }, [windData, speedFactor, trailLength, maxAge]);

  // Create deck.gl layers with fading trails
  const createLayers = useCallback(() => {
    if (!windData) return [];
    
    const particles = particlesRef.current;
    const { imageData, width, height } = windData;

    // Build path data with color based on wind magnitude at head position
    const pathData = particles
      .filter((p) => p.trail.length > 1)
      .map((p) => {
        // Get wind magnitude at particle head
        const px = Math.floor(p.x);
        const py = Math.floor(p.y);
        let magnitude = 5;
        
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const idx = (py * width + px) * 4;
          const r = imageData.data[idx];
          const g = imageData.data[idx + 1];
          const u = ((r / 255) * 100 - 50);
          const v = ((g / 255) * 100 - 50);
          magnitude = Math.sqrt(u * u + v * v);
        }

        const baseColor = getColorForMagnitude(magnitude);
        
        return {
          path: p.trail.map(t => [t.lng, t.lat]),
          color: baseColor,
          // Fade based on particle age (younger = brighter)
          opacity: Math.max(0.1, 1 - (p.age / p.maxAge) * 0.5),
        };
      });

    return [
      new PathLayer({
        id: 'wind-trails',
        data: pathData,
        getPath: (d: any) => d.path,
        getColor: (d: any) => [...d.color, Math.floor(d.opacity * 200)],
        getWidth: lineWidth,
        widthUnits: 'pixels',
        widthMinPixels: 1,
        widthMaxPixels: 3,
        capRounded: true,
        jointRounded: true,
        billboard: false,
        opacity: opacity,
        // Fade along the trail
        getPolygonOffset: () => [0, -100],
      }),
    ];
  }, [windData, lineWidth, opacity]);

  // Animation loop
  useEffect(() => {
    if (!enabled || !windData || !mapRef.current) return;

    const map = mapRef.current.getMap();
    if (!map) return;

    // Create overlay if it doesn't exist
    if (!overlayRef.current) {
      overlayRef.current = new MapboxOverlay({
        interleaved: true,
        layers: [],
      });
      map.addControl(overlayRef.current as any);
    }

    // Initialize particles
    initParticles();

    let lastTime = 0;
    const targetFPS = 30; // Limit frame rate for smoother animation
    const frameInterval = 1000 / targetFPS;

    // Animation loop
    const animate = (currentTime: number) => {
      if (currentTime - lastTime >= frameInterval) {
        updateParticles();
        
        if (overlayRef.current) {
          overlayRef.current.setProps({
            layers: createLayers(),
          });
        }
        lastTime = currentTime;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, windData, mapRef, initParticles, updateParticles, createLayers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (overlayRef.current && mapRef.current) {
        const map = mapRef.current.getMap();
        if (map) {
          try {
            map.removeControl(overlayRef.current as any);
          } catch (e) {
            // Ignore errors during cleanup
          }
        }
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [mapRef]);

  // Handle enable/disable
  useEffect(() => {
    if (!overlayRef.current) return;

    if (!enabled) {
      overlayRef.current.setProps({ layers: [] });
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
  }, [enabled]);

  // Reinitialize when particle count changes
  useEffect(() => {
    if (enabled && windData) {
      initParticles();
    }
  }, [particleCount, enabled, windData, initParticles]);

  return null;
}

export default DeckWindParticleLayer;
