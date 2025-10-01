'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, updateDoc, collection, addDoc, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const symbols = [
  { emoji: '🍒', weight: 30, payout: 2 },
  { emoji: '🍋', weight: 25, payout: 3 },
  { emoji: '🍊', weight: 20, payout: 5 },
  { emoji: '🔔', weight: 15, payout: 10 },
  { emoji: '💎', weight: 7, payout: 20 },
  { emoji: '7️⃣', weight: 3, payout: 50 },
]

const getRandomSymbol = () => {
  const totalWeight = symbols.reduce((sum, s) => sum + s.weight, 0)
  let random = Math.random() * totalWeight
  
  for (const symbol of symbols) {
    random -= symbol.weight
    if (random <= 0) return symbol
  }
  return symbols[0]
}

export default function SlotMachine() {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState('')
  const [balance, setBalance] = useState(0)
  const [bet, setBet] = useState(10)
  const [reels, setReels] = useState([symbols[0], symbols[1], symbols[2]])
  const [spinning, setSpinning] = useState(false)
  const [message, setMessage] = useState('')
  const [recentResults, setRecentResults] = useState([])
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
  }, [])

  useEffect(() => {
    // Listen to recent slot results
    const q = query(
      collection(db, 'slot-results'),
      orderBy('timestamp', 'desc'),
      limit(10)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results = []
      snapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() })
      })
      setRecentResults(results)
    })

    return () => unsubscribe()
  }, [])

  const handleSpin = async () => {
    if (bet > balance) {
      setMessage('Yetersiz bakiye!')
      return
    }

    if (bet < 1) {
      setMessage('Minimum bahis 1₺!')
      return
    }

    setSpinning(true)
    setMessage('')

    // Deduct bet from balance
    const newBalance = balance - bet
    setBalance(newBalance)
    await updateDoc(doc(db, 'users', user.uid), {
      virtualCurrencyBalance: newBalance
    })

    // Animate reels
    let spinCount = 0
    const spinInterval = setInterval(() => {
      setReels([getRandomSymbol(), getRandomSymbol(), getRandomSymbol()])
      spinCount++
      if (spinCount >= 20) {
        clearInterval(spinInterval)
      }
    }, 100)

    // Final result
    setTimeout(async () => {
      const finalReels = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()]
      setReels(finalReels)

      // Check for win
      let winAmount = 0
      const symbols = finalReels.map(r => r.emoji)

      if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
        // 3 matching symbols
        winAmount = finalReels[0].payout * bet
        setMessage(`🎉 BÜYÜK KAZANÇ! +${winAmount.toFixed(2)}₺`)
      } else if (symbols[0] === symbols[1] || symbols[1] === symbols[2] || symbols[0] === symbols[2]) {
        // 2 matching symbols
        const matchedSymbol = symbols[0] === symbols[1] ? finalReels[0] : 
                              symbols[1] === symbols[2] ? finalReels[1] : finalReels[0]
        winAmount = (matchedSymbol.payout / 2) * bet
        setMessage(`👍 İyi! +${winAmount.toFixed(2)}₺`)
      } else {
        setMessage('Kaybettiniz! 😔')
      }

      // Update balance if won
      if (winAmount > 0) {
        const updatedBalance = newBalance + winAmount
        setBalance(updatedBalance)
        await updateDoc(doc(db, 'users', user.uid), {
          virtualCurrencyBalance: updatedBalance
        })
      }

      // Save result to Firestore
      await addDoc(collection(db, 'slot-results'), {
        username: username,
        result: winAmount > 0 ? 'kazandı' : 'kaybetti',
        amount: winAmount > 0 ? winAmount : bet,
        timestamp: Timestamp.now()
      })

      setSpinning(false)
    }, 2000)
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Yükleniyor...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Slot Machine */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline text-3xl text-center">🎰 Slot Machine</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Reels */}
              <div className="flex justify-center items-center gap-4 p-8 bg-secondary rounded-lg">
                {reels.map((symbol, index) => (
                  <div
                    key={index}
                    className={`w-24 h-24 flex items-center justify-center text-6xl bg-background rounded-lg border-2 border-primary ${
                      spinning ? 'animate-pulse' : ''
                    }`}
                  >
                    {symbol.emoji}
                  </div>
                ))}
              </div>

              {/* Message */}
              {message && (
                <div className={`text-center text-lg font-bold p-4 rounded-lg ${
                  message.includes('KAZANÇ') || message.includes('İyi') 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {message}
                </div>
              )}

              {/* Bet Controls */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bet">Bahis Miktarı (₺)</Label>
                  <Input
                    id="bet"
                    type="number"
                    min="1"
                    max={balance}
                    value={bet}
                    onChange={(e) => setBet(Number(e.target.value))}
                    disabled={spinning}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => setBet(10)}
                    variant="outline"
                    disabled={spinning}
                    className="flex-1"
                  >
                    10₺
                  </Button>
                  <Button
                    onClick={() => setBet(50)}
                    variant="outline"
                    disabled={spinning}
                    className="flex-1"
                  >
                    50₺
                  </Button>
                  <Button
                    onClick={() => setBet(100)}
                    variant="outline"
                    disabled={spinning}
                    className="flex-1"
                  >
                    100₺
                  </Button>
                </div>

                <Button
                  onClick={handleSpin}
                  disabled={spinning || balance < bet}
                  className="w-full h-14 text-lg"
                >
                  {spinning ? 'Çevriliyor...' : '🎰 ÇEVİR'}
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  Bakiyeniz: <span className="font-bold text-primary">{balance.toFixed(2)}₺</span>
                </div>
              </div>

              {/* Payout Table with Odds */}
              <div className="space-y-2">
                <h3 className="font-headline font-bold">Ödeme Tablosu & Şans Oranları</h3>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  {symbols.map((symbol) => {
                    const totalWeight = symbols.reduce((sum, s) => sum + s.weight, 0)
                    const singleChance = (symbol.weight / totalWeight) * 100
                    const tripleChance = Math.pow(symbol.weight / totalWeight, 3) * 100
                    
                    return (
                      <div key={symbol.emoji} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{symbol.emoji} {symbol.emoji} {symbol.emoji}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-primary">{symbol.payout}x</div>
                          <div className="text-xs text-muted-foreground">
                            %{tripleChance.toFixed(2)} şans
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
                  💡 İpucu: 2 eşleşme ödemenin yarısını verir
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Results Feed */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">🔴 Canlı Sonuçlar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {recentResults.map((result) => (
                  <div
                    key={result.id}
                    className={`p-3 rounded-lg border ${
                      result.result === 'kazandı'
                        ? 'bg-green-500/10 border-green-500/50'
                        : 'bg-red-500/10 border-red-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{result.username}</span>
                      <span className={result.result === 'kazandı' ? 'text-green-400' : 'text-red-400'}>
                        {result.result === 'kazandı' ? '+' : '-'}{result.amount.toFixed(2)}₺
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {result.result === 'kazandı' ? '✅ Kazandı' : '❌ Kaybetti'}
                    </div>
                  </div>
                ))}

                {recentResults.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    Henüz sonuç yok
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}