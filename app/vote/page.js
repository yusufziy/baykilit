'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ThumbsUp } from 'lucide-react'

export default function Vote() {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/login')
      } else {
        setUser(currentUser)
        const userDoc = await (await import('firebase/firestore')).getDoc(
          (await import('firebase/firestore')).doc(db, 'users', currentUser.uid)
        )
        if (userDoc.exists()) {
          setUsername(userDoc.data().username)
        }
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  useEffect(() => {
    const q = query(
      collection(db, 'suggestions'),
      orderBy('timestamp', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sug = []
      snapshot.forEach((doc) => {
        sug.push({ id: doc.id, ...doc.data() })
      })
      setSuggestions(sug)
    })

    return () => unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!suggestion.trim()) return

    try {
      await addDoc(collection(db, 'suggestions'), {
        username: username,
        userId: user.uid,
        suggestion: suggestion,
        votes: 0,
        timestamp: Timestamp.now()
      })

      setSuggestion('')
    } catch (error) {
      console.error('Suggestion error:', error)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Yükleniyor...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-headline text-4xl font-bold">DAO Oylama</h1>
          <p className="text-muted-foreground">
            Platformun geleceğini şekillendirin! Önerilerinizi paylaşın.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Yeni Öneri</CardTitle>
            <CardDescription>
              Yeni oyun, özellik veya iyileştirme önerilerinizi paylaşın.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="suggestion">Öneriniz</Label>
                <Textarea
                  id="suggestion"
                  placeholder="Örn: Sweet Bonanza tarzı daha fazla slot oyunu eklensin!"
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  rows={4}
                />
              </div>
              <Button type="submit" className="w-full">
                Öneri Gönder
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="font-headline text-2xl font-bold">Öneriler</h2>
          {suggestions.map((sug) => (
            <Card key={sug.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{sug.username}</span>
                      <span className="text-xs text-muted-foreground">
                        {sug.timestamp?.toDate().toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                    <p className="text-foreground">{sug.suggestion}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled>
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      {sug.votes || 0}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {suggestions.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Henüz öneri yok. İlk öneriyi siz gönderin!
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}