'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

export default function Profile() {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState('')
  const [balance, setBalance] = useState(0)
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
          const data = userDoc.data()
          setUsername(data.username)
          setBalance(data.virtualCurrencyBalance || 0)
        }
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Yükleniyor...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-3xl text-center">Profilim</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="h-32 w-32">
                <AvatarImage src={`https://api.dicebear.com/7.x/bottts/svg?seed=${username}`} />
                <AvatarFallback>{username?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>

              <div className="text-center space-y-2">
                <h2 className="font-headline text-2xl font-bold">{username}</h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 rounded-lg bg-secondary text-center space-y-2">
                <p className="text-sm text-muted-foreground">Mevcut Bakiye</p>
                <p className="font-headline text-3xl font-bold text-primary">{balance.toFixed(2)}₺</p>
              </div>

              <div className="p-6 rounded-lg bg-secondary text-center space-y-2">
                <p className="text-sm text-muted-foreground">Hesap Durumu</p>
                <p className="font-headline text-xl font-bold text-green-400">Aktif ✅</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-sm text-muted-foreground">
                Baykilit'e hoş geldiniz! Oyunların tadını çıkarın! 🎰
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}