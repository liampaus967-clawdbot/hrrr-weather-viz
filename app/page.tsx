'use client';

import dynamic from 'next/dynamic';

// Dynamically import the map component to avoid SSR issues with mapbox-gl
const ParticleApp = dynamic(() => import('@/components/ParticleApp'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#1a1a2e',
      color: 'white',
      fontSize: '18px'
    }}>
      Loading HRRR Weather Visualization...
    </div>
  ),
});

export default function Home() {
  return <ParticleApp />;
}
