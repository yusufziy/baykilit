'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, onSnapshot, doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Play } from 'lucide-react'
import Link from 'next/link'

export default function BlackjackLobbies() {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState('')
  const [lobbies, setLobbies] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/login')
      } else {
        setUser(currentUser)
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
        if (userDoc.exists()) {
          setUsername(userDoc.data().username)
        }
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  // Listen to all lobbies
  useEffect(() => {
    const q = query(collection(db, 'blackjack-lobbies'))
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lobbyList = []
      snapshot.forEach((doc) => {
        lobbyList.push({ id: doc.id, ...doc.data() })
      })
      setLobbies(lobbyList)
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
          <h1 className="font-headline text-4xl font-bold">🃏 Blackjack Lobiler</h1>
          <p className="text-muted-foreground">
            Bir masaya katıl ve kazanmaya başla!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {['Lobi 1', 'Lobi 2', 'Lobi 3'].map((lobbyName, index) => {
            const lobbyId = `lobby-${index + 1}`
            const lobbyData = lobbies.find(l => l.id === lobbyId)
            const playerCount = lobbyData?.players?.length || 0
            const isPlaying = lobbyData?.phase === 'playing'

            return (
              <Card key={lobbyId} className="bg-card/50 backdrop-blur border-border hover:border-primary transition-all group">
                <CardHeader>
                  <CardTitle className="font-headline text-2xl">{lobbyName}</CardTitle>
                  <CardDescription>
                    <div className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5" />
                      <span>{playerCount}/4 Oyuncu</span>
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Durum:</span>
                    <span className={`font-bold ${isPlaying ? 'text-green-400' : 'text-primary'}`}>
                      {isPlaying ? '🎮 Oyunda' : '⏳ Bekliyor'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Minimum Bahis:</span>
                    <span className="font-bold text-primary">10₺</span>
                  </div>

                  <Link href={`/games/blackjack/${lobbyId}`}>
                    <Button className="w-full" disabled={playerCount >= 4}>
                      <Play className="mr-2 h-4 w-4" />
                      {playerCount >= 4 ? 'Masa Dolu' : 'Masaya Katıl'}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Rules */}
        <Card className="bg-secondary/30">
          <CardHeader>
            <CardTitle className="font-headline">📜 Kurallar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>• Her lobide maksimum 4 oyuncu olabilir</p>
            <p>• Krupiye otomatik olarak kart dağıtır</p>
            <p>• Her oyuncunun 30 saniye düşünme süresi vardır</p>
            <p>• Amaç 21'e en yakın olmaktır (21'i geçmeden)</p>
            <p>• Krupiye 17'de durur</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
