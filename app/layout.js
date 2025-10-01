import './globals.css'
import Snowfall from '@/components/Snowfall'
import Header from '@/components/Header'

export const metadata = {
  title: 'Baykilit Eğlence - Casino & Arcade Oyunları',
  description: 'Sanal para ile slot, rulet ve blackjack oynayın!',
}

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body className="min-h-screen">
        <Snowfall />
        <div className="relative z-10">
          <Header />
          <main>{children}</main>
        </div>
      </body>
    </html>
  )
}