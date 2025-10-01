'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { Sparkles, Dices, CircleDot } from 'lucide-react'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/games')
      }
    })

    return () => unsubscribe()
  }, [])

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <div className="space-y-4">
          <h1 className="font-headline text-5xl md:text-7xl font-bold">
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Baykilit Eğlence
            </span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Sanal para ile gerçek casino deneyimi! ❄️
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <Card className="bg-card/50 backdrop-blur border-border hover:border-primary/50 transition-all">
            <CardContent className="p-6 text-center space-y-4">
              <Sparkles className="h-12 w-12 mx-auto text-primary" />
              <h3 className="font-headline text-xl font-bold">Slot Machine</h3>
              <p className="text-sm text-muted-foreground">
                777 ve Sweet Bonanza tarzı slot oyunları
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border hover:border-primary/50 transition-all">
            <CardContent className="p-6 text-center space-y-4">
              <CircleDot className="h-12 w-12 mx-auto text-primary" />
              <h3 className="font-headline text-xl font-bold">Roulette</h3>
              <p className="text-sm text-muted-foreground">
                Canlı rulet masası ile şansını dene
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border hover:border-primary/50 transition-all">
            <CardContent className="p-6 text-center space-y-4">
              <Dices className="h-12 w-12 mx-auto text-primary" />
              <h3 className="font-headline text-xl font-bold">Blackjack</h3>
              <p className="text-sm text-muted-foreground">
                Multiplayer blackjack masaları
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
          <Link href="/signup">
            <Button size="lg" className="w-full sm:w-auto">
              Kayıt Ol
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              Giriş Yap
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}