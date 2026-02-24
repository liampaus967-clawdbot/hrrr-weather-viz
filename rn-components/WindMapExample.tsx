/**
 * Example usage of SkiaWindParticles with @rnmapbox/maps
 * 
 * Install deps:
 *   npm install @rnmapbox/maps @shopify/react-native-skia react-native-reanimated
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { SkiaWindParticles } from './SkiaWindParticles';

// Set your Mapbox token
MapboxGL.setAccessToken('YOUR_MAPBOX_TOKEN');

interface WindData {
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

export function WindMapExample() {
  const { width, height } = useWindowDimensions();
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);
  
  const [camera, setCamera] = useState<{ zoom: number; center: [number, number] } | null>(null);
  const [mapBounds, setMapBounds] = useState<{ ne: [number, number]; sw: [number, number] } | null>(null);
  const [windData, setWindData] = useState<WindData | null>(null);
  const [windEnabled, setWindEnabled] = useState(true);

  // Fetch wind data from your S3 bucket
  const fetchWindData = useCallback(async () => {
    try {
      // Replace with your actual wind data endpoint
      const response = await fetch(
        'https://your-bucket.s3.amazonaws.com/wind/latest.png'
      );
      const blob = await response.blob();
      
      // Decode PNG to get wind components
      // You'll need to implement this based on your data format
      // This is a placeholder - real implementation depends on your data encoding
      
      // For now, create mock data for testing
      const mockWidth = 360;
      const mockHeight = 180;
      const mockData = new Uint8Array(mockWidth * mockHeight * 4);
      
      // Fill with random wind data for testing
      for (let i = 0; i < mockData.length; i += 4) {
        mockData[i] = Math.floor(Math.random() * 100) + 78;     // U component (centered at 128)
        mockData[i + 1] = Math.floor(Math.random() * 100) + 78; // V component
        mockData[i + 2] = 0;  // unused
        mockData[i + 3] = 255; // alpha
      }
      
      setWindData({
        width: mockWidth,
        height: mockHeight,
        data: mockData,
        bounds: {
          west: -125,
          east: -65,
          north: 50,
          south: 24,
        },
      });
    } catch (error) {
      console.error('Failed to fetch wind data:', error);
    }
  }, []);

  useEffect(() => {
    fetchWindData();
  }, [fetchWindData]);

  // Handle camera changes
  const onCameraChanged = useCallback(async () => {
    if (!mapRef.current) return;
    
    try {
      const bounds = await mapRef.current.getVisibleBounds();
      const zoom = await mapRef.current.getZoom();
      const center = await mapRef.current.getCenter();
      
      setMapBounds({
        ne: bounds[0] as [number, number],
        sw: bounds[1] as [number, number],
      });
      
      setCamera({
        zoom: zoom ?? 3,
        center: center as [number, number],
      });
    } catch (error) {
      console.error('Failed to get map state:', error);
    }
  }, []);

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Dark}
        onCameraChanged={onCameraChanged}
        onMapIdle={onCameraChanged}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [-98, 39],
            zoomLevel: 4,
          }}
        />
      </MapboxGL.MapView>
      
      {/* Skia wind particle overlay */}
      <SkiaWindParticles
        windData={windData}
        mapCamera={camera}
        mapBounds={mapBounds}
        screenWidth={width}
        screenHeight={height}
        enabled={windEnabled}
        baseParticleCount={3000}
        trailLength={12}
        maxAge={60}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});

export default WindMapExample;
