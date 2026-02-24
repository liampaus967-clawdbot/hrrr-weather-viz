'use client';

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer, LineLayer } from '@deck.gl/layers';
import type { MapRef } from 'react-map-gl';
import type { WindData } from '@/hooks/useWindData';

interface Particle {
  id: number;
  x: number;
  y: number;
  lng: number;
  lat: number;
  age: number;
  maxAge: number;
  u: number;
  v: number;
  magnitude: number;
  trail: [number, number][];
}

interface DeckWindParticleLayerProps {
  mapRef: React.RefObject<MapRef>;
  windData: WindData | null;
  enabled?: boolean;
  particleCount?: number;
  particleSize?: number;
  speedFactor?: number;
  fadeOpacity?: number;
  trailLength?: number;
  colorScale?: [number, number, number][];
  maxAge?: number;
}

// Color scale for wind speed (m/s)
const DEFAULT_COLOR_SCALE: [number, number, number][] = [
  [65, 182, 196],   // 0-5 m/s - light blue
  [127, 205, 187],  // 5-10 m/s - teal
  [199, 233, 180],  // 10-15 m/s - light green
  [237, 248, 177],  // 15-20 m/s - yellow-green
  [255, 237, 160],  // 20-25 m/s - yellow
  [254, 217, 118],  // 25-30 m/s - orange-yellow
  [254, 178, 76],   // 30-35 m/s - orange
  [253, 141, 60],   // 35-40 m/s - dark orange
  [252, 78, 42],    // 40-45 m/s - red-orange
  [227, 26, 28],    // 45+ m/s - red
];

function getColorForMagnitude(magnitude: number, colorScale: [number, number, number][]): [number, number, number, number] {
  const maxSpeed = 50; // m/s
  const normalized = Math.min(magnitude / maxSpeed, 1);
  const index = Math.min(Math.floor(normalized * (colorScale.length - 1)), colorScale.length - 1);
  const color = colorScale[index];
  const alpha = Math.min(150 + magnitude * 3, 255); // Brighter for faster wind
  return [color[0], color[1], color[2], alpha];
}

export function DeckWindParticleLayer({
  mapRef,
  windData,
  enabled = true,
  particleCount = 5000,
  particleSize = 2,
  speedFactor = 0.25,
  fadeOpacity = 0.96,
  trailLength = 8,
  colorScale = DEFAULT_COLOR_SCALE,
  maxAge = 100,
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
        lng,
        lat,
        age: Math.floor(Math.random() * maxAge),
        maxAge: maxAge + Math.floor(Math.random() * 20),
        u: 0,
        v: 0,
        magnitude: 0,
        trail: [[lng, lat]],
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
          particle.u = ((r / 255) * 100 - 50); // -50 to +50 m/s
          particle.v = ((g / 255) * 100 - 50);
          particle.magnitude = Math.sqrt(particle.u * particle.u + particle.v * particle.v);

          // Update position
          particle.x += particle.u * speedFactor;
          particle.y -= particle.v * speedFactor; // Y is inverted in image coords

          // Update lat/lng
          particle.lng = bounds.west + (particle.x / width) * (bounds.east - bounds.west);
          particle.lat = bounds.north - (particle.y / height) * (bounds.north - bounds.south);

          // Update trail
          particle.trail.push([particle.lng, particle.lat]);
          if (particle.trail.length > trailLength) {
            particle.trail.shift();
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
        particle.lng = bounds.west + (particle.x / width) * (bounds.east - bounds.west);
        particle.lat = bounds.north - (particle.y / height) * (bounds.north - bounds.south);
        particle.age = 0;
        particle.maxAge = maxAge + Math.floor(Math.random() * 20);
        particle.trail = [[particle.lng, particle.lat]];
      }
    });
  }, [windData, speedFactor, trailLength, maxAge]);

  // Create deck.gl layers
  const createLayers = useCallback(() => {
    const particles = particlesRef.current;
    if (particles.length === 0) return [];

    // Trail layer (lines)
    const trailData = particles
      .filter((p) => p.trail.length > 1 && p.magnitude > 0.5)
      .map((p) => ({
        id: p.id,
        path: p.trail,
        color: getColorForMagnitude(p.magnitude, colorScale),
        width: Math.max(1, particleSize * 0.5),
      }));

    // Particle head layer (points)
    const pointData = particles
      .filter((p) => p.magnitude > 0.5)
      .map((p) => ({
        position: [p.lng, p.lat],
        color: getColorForMagnitude(p.magnitude, colorScale),
        radius: particleSize + p.magnitude * 0.1,
      }));

    return [
      new LineLayer({
        id: 'wind-trails',
        data: trailData,
        getSourcePosition: (d: any) => d.path[0],
        getTargetPosition: (d: any) => d.path[d.path.length - 1],
        getColor: (d: any) => d.color,
        getWidth: (d: any) => d.width,
        widthUnits: 'pixels',
        opacity: 0.6,
      }),
      new ScatterplotLayer({
        id: 'wind-particles',
        data: pointData,
        getPosition: (d: any) => d.position,
        getFillColor: (d: any) => d.color,
        getRadius: (d: any) => d.radius,
        radiusUnits: 'pixels',
        opacity: 0.8,
      }),
    ];
  }, [colorScale, particleSize]);

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

    // Animation loop
    const animate = () => {
      updateParticles();
      
      if (overlayRef.current) {
        overlayRef.current.setProps({
          layers: createLayers(),
        });
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

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

  return null; // This component renders via deck.gl overlay, not React DOM
}

export default DeckWindParticleLayer;
