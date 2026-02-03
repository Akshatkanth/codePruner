import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CodePruner Dashboard',
  description: 'Monitor and identify unused API endpoints',
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
