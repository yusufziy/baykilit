'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Sparkles, CircleDot, Dices } from 'lucide-react'

export default function Games() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login')
      } else {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Yükleniyor...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-headline text-4xl font-bold">Oyunlar</h1>
          <p className="text-muted-foreground">Favori oyununu seç ve kazanmaya başla!</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card/50 backdrop-blur border-border hover:border-primary transition-all group">
            <CardHeader>
              <Sparkles className="h-12 w-12 text-primary mb-4 group-hover:scale-110 transition-transform" />
              <CardTitle className="font-headline">Slot Machine</CardTitle>
              <CardDescription>
                777 ve Sweet Bonanza tarzı slot oyunları
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/games/slot">
                <Button className="w-full">Oyna</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border hover:border-primary transition-all group">
            <CardHeader>
              <CircleDot className="h-12 w-12 text-primary mb-4 group-hover:scale-110 transition-transform" />
              <CardTitle className="font-headline">Roulette</CardTitle>
              <CardDescription>
                Canlı rulet masası ile şansını dene
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/games/roulette">
                <Button className="w-full">Oyna</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border hover:border-primary transition-all group">
            <CardHeader>
              <Dices className="h-12 w-12 text-primary mb-4 group-hover:scale-110 transition-transform" />
              <CardTitle className="font-headline">Blackjack</CardTitle>
              <CardDescription>
                Multiplayer blackjack masaları
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/games/blackjack">
                <Button className="w-full">
                  Oyna
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}