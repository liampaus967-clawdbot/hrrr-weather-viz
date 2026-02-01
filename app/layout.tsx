import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HRRR Weather Visualization',
  description: 'Real-time HRRR weather data visualization with animated wind particles',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
