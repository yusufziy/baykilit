'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  Timestamp,
  writeBatch,
  getDocs,
  setDoc
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import RouletteWheel from '@/components/RouletteWheel'

const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]

const TABLE_ID = 'main-table'

export default function Roulette() {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState('')
  const [balance, setBalance] = useState(0)
  const [bet, setBet] = useState(10)
  const [selectedNumbers, setSelectedNumbers] = useState([])
  const [selectedOption, setSelectedOption] = useState(null)
  const [rotation, setRotation] = useState(0)
  const [winningNumber, setWinningNumber] = useState(null)
  const [message, setMessage] = useState('')
  const [recentSpins, setRecentSpins] = useState([])
  const [loading, setLoading] = useState(true)
  const [timeLeft, setTimeLeft] = useState(30)
  const [phase, setPhase] = useState('betting') // 'betting' or 'spinning'
  const [myBets, setMyBets] = useState([])
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
        
        // Initialize table if needed
        const tableRef = doc(db, 'roulette-tables', TABLE_ID)
        const tableSnap = await getDoc(tableRef)
        if (!tableSnap.exists()) {
          await setDoc(tableRef, {
            phase: 'betting',
            timeLeft: 30,
            winningNumber: null,
            rotation: 0,
            lastUpdate: Timestamp.now()
          })
        }
        
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  // Listen to table state
  useEffect(() => {
    const tableRef = doc(db, 'roulette-tables', TABLE_ID)
    const unsubscribe = onSnapshot(tableRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data()
        setPhase(data.phase || 'betting')
        setTimeLeft(data.timeLeft || 30)
        setWinningNumber(data.winningNumber)
        setRotation(data.rotation || 0)
      }
    })

    return () => unsubscribe()
  }, [])

  // Timer countdown
  useEffect(() => {
    if (!user) return

    const interval = setInterval(async () => {
      const tableRef = doc(db, 'roulette-tables', TABLE_ID)
      const tableSnap = await getDoc(tableRef)
      
      if (tableSnap.exists()) {
        const data = tableSnap.data()
        const currentTime = data.timeLeft || 30
        const currentPhase = data.phase || 'betting'

        if (currentPhase === 'betting' && currentTime > 0) {
          await updateDoc(tableRef, { timeLeft: currentTime - 1 })
        } else if (currentPhase === 'betting' && currentTime <= 0) {
          // Start spinning
          await spinWheel()
        } else if (currentPhase === 'spinning') {
          // Wait for spin to complete (5 seconds), then reset to betting
          const lastUpdate = data.lastUpdate?.toDate() || new Date()
          const elapsed = (new Date() - lastUpdate) / 1000
          
          if (elapsed > 8) {
            await updateDoc(tableRef, {
              phase: 'betting',
              timeLeft: 30,
              lastUpdate: Timestamp.now()
            })
            setMyBets([])
            setSelectedNumbers([])
            setSelectedOption(null)
          }
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [user])

  // Listen to recent spins
  useEffect(() => {
    const q = query(
      collection(db, 'roulette-spins'),
      orderBy('timestamp', 'desc'),
      limit(10)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const spins = []
      snapshot.forEach((doc) => {
        spins.push({ id: doc.id, ...doc.data() })
      })
      setRecentSpins(spins)
    })

    return () => unsubscribe()
  }, [])

  const getNumberColor = (num) => {
    if (num === 0) return 'green'
    if (redNumbers.includes(num)) return 'red'
    return 'black'
  }

  const handleNumberSelect = (num) => {
    if (phase !== 'betting') return
    
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num))
    } else {
      setSelectedNumbers([...selectedNumbers, num])
    }
    setSelectedOption(null)
  }

  const handleOptionSelect = (option) => {
    if (phase !== 'betting') return
    setSelectedOption(option)
    setSelectedNumbers([])
  }

  const placeBet = async () => {
    if (phase !== 'betting') {
      setMessage('Bahis süresi bitti!')
      return
    }

    if (bet < 1) {
      setMessage('Minimum bahis 1₺!')
      return
    }

    if (bet > balance) {
      setMessage('Yetersiz bakiye!')
      return
    }

    if (selectedNumbers.length === 0 && !selectedOption) {
      setMessage('Lütfen bir sayı veya seçenek seçin!')
      return
    }

    try {
      const betData = {
        userId: user.uid,
        username: username,
        amount: bet,
        timestamp: Timestamp.now()
      }

      if (selectedNumbers.length > 0) {
        betData.type = 'number'
        betData.value = selectedNumbers
      } else {
        betData.type = 'option'
        betData.value = selectedOption
      }

      const betRef = doc(collection(db, `roulette-tables/${TABLE_ID}/bets`))
      await setDoc(betRef, betData)

      setMyBets([...myBets, betData])
      setMessage('✅ Bahis yerleştirildi!')
      
      const newBalance = balance - bet
      setBalance(newBalance)
      await updateDoc(doc(db, 'users', user.uid), {
        virtualCurrencyBalance: newBalance
      })

    } catch (error) {
      console.error('Bet placement error:', error)
      setMessage('Bahis yerleştirilemedi!')
    }
  }

  const spinWheel = async () => {
    try {
      const tableRef = doc(db, 'roulette-tables', TABLE_ID)
      
      // Generate winning number
      const winning = Math.floor(Math.random() * 37)
      
      // Calculate rotation
      const wheelOrder = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
      const index = wheelOrder.indexOf(winning)
      const anglePerSegment = 360 / 37
      const targetAngle = index * anglePerSegment
      const fullRotations = 5 * 360
      const finalRotation = fullRotations + targetAngle

      await updateDoc(tableRef, {
        phase: 'spinning',
        rotation: finalRotation,
        winningNumber: winning,
        lastUpdate: Timestamp.now()
      })

      // Process bets after 5 seconds
      setTimeout(() => processBets(winning), 5000)

    } catch (error) {
      console.error('Spin error:', error)
    }
  }

  const processBets = async (winning) => {
    try {
      const betsRef = collection(db, `roulette-tables/${TABLE_ID}/bets`)
      const betsSnapshot = await getDocs(betsRef)
      
      const batch = writeBatch(db)
      const results = []
      const userBalanceUpdates = {}

      betsSnapshot.forEach((betDoc) => {
        const betData = betDoc.data()
        let won = false
        let payout = 0

        if (betData.type === 'number') {
          if (betData.value.includes(winning)) {
            won = true
            payout = betData.amount * 35
          }
        } else if (betData.type === 'option') {
          if (betData.value === 'Kırmızı' && redNumbers.includes(winning)) {
            won = true
            payout = betData.amount * 2
          } else if (betData.value === 'Siyah' && blackNumbers.includes(winning)) {
            won = true
            payout = betData.amount * 2
          } else if (betData.value === 'Çift' && winning !== 0 && winning % 2 === 0) {
            won = true
            payout = betData.amount * 2
          } else if (betData.value === 'Tek' && winning % 2 !== 0) {
            won = true
            payout = betData.amount * 2
          }
        }

        results.push({
          username: betData.username,
          userId: betData.userId,
          result: won ? 'kazandı' : 'kaybetti',
          amount: won ? payout : betData.amount
        })

        if (won) {
          if (!userBalanceUpdates[betData.userId]) {
            userBalanceUpdates[betData.userId] = 0
          }
          userBalanceUpdates[betData.userId] += payout
        }

        batch.delete(betDoc.ref)
      })

      // Update user balances
      for (const [userId, winAmount] of Object.entries(userBalanceUpdates)) {
        const userRef = doc(db, 'users', userId)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const currentBalance = userSnap.data().virtualCurrencyBalance || 0
          batch.update(userRef, {
            virtualCurrencyBalance: currentBalance + winAmount
          })
        }
      }

      await batch.commit()

      // Save spin result
      await setDoc(doc(collection(db, 'roulette-spins')), {
        winningNumber: winning,
        results: results,
        timestamp: Timestamp.now()
      })

      // Update my balance if won
      if (userBalanceUpdates[user.uid]) {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists()) {
          setBalance(userDoc.data().virtualCurrencyBalance || 0)
          setMessage(`🎉 KAZANDINIZ! +${userBalanceUpdates[user.uid].toFixed(2)}₺`)
        }
      } else {
        const myResult = results.find(r => r.userId === user.uid)
        if (myResult) {
          setMessage('Kaybettiniz! 😔')
        }
      }

    } catch (error) {
      console.error('Process bets error:', error)
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
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Roulette */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline text-3xl text-center">
                🎰 Roulette
              </CardTitle>
              <div className="text-center">
                {phase === 'betting' ? (
                  <div className="text-2xl font-bold text-primary">
                    Bahis Süresi: {timeLeft}s
                  </div>
                ) : (
                  <div className="text-2xl font-bold text-amber-500">
                    Çark Dönüyor! 🎲
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Wheel */}
              <RouletteWheel rotation={rotation} winningNumber={phase === 'betting' ? null : winningNumber} />

              {/* Message */}
              {message && (
                <div className={`text-center text-lg font-bold p-4 rounded-lg ${
                  message.includes('KAZANDINIZ') 
                    ? 'bg-green-500/20 text-green-400' 
                    : message.includes('Kaybettiniz')
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {message}
                </div>
              )}

              {phase === 'betting' && (
                <>
                  {/* Number Grid */}
                  <div>
                    <h3 className="font-headline font-bold mb-2">Sayılar</h3>
                    <div className="grid grid-cols-12 gap-2">
                      <div
                        onClick={() => handleNumberSelect(0)}
                        className={`col-span-12 h-14 flex items-center justify-center rounded-lg font-bold text-xl cursor-pointer border-2 transition-all ${
                          selectedNumbers.includes(0)
                            ? 'border-primary bg-primary/20 scale-95'
                            : 'border-border bg-green-600 hover:bg-green-500'
                        }`}
                      >
                        0
                      </div>
                      {[...Array(36)].map((_, i) => {
                        const num = i + 1
                        const color = getNumberColor(num)
                        return (
                          <div
                            key={num}
                            onClick={() => handleNumberSelect(num)}
                            className={`col-span-1 h-14 flex items-center justify-center rounded-lg font-bold text-lg cursor-pointer border-2 transition-all ${
                              selectedNumbers.includes(num)
                                ? 'border-primary bg-primary/20 scale-95'
                                : color === 'red'
                                ? 'border-border bg-red-600 hover:bg-red-500'
                                : 'border-border bg-gray-900 hover:bg-gray-800'
                            }`}
                          >
                            {num}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Options */}
                  <div>
                    <h3 className="font-headline font-bold mb-2">Seçenekler</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {['Kırmızı', 'Siyah', 'Çift', 'Tek'].map((option) => (
                        <Button
                          key={option}
                          onClick={() => handleOptionSelect(option)}
                          variant={selectedOption === option ? 'default' : 'outline'}
                          className="h-12"
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  </div>

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
                      />
                    </div>

                    <Button onClick={placeBet} className="w-full h-12">
                      💰 Bahis Yerleştir
                    </Button>

                    <div className="text-center text-sm text-muted-foreground">
                      Bakiyeniz: <span className="font-bold text-primary">{balance.toFixed(2)}₺</span>
                    </div>
                  </div>

                  {/* My Bets */}
                  {myBets.length > 0 && (
                    <div className="p-4 bg-secondary/50 rounded-lg">
                      <h4 className="font-bold mb-2">Bahisleriniz:</h4>
                      {myBets.map((b, idx) => (
                        <div key={idx} className="text-sm">
                          {b.type === 'number' ? `Sayılar: ${b.value.join(', ')}` : b.value} - {b.amount}₺
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Spins */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">📊 Son Çevirmeler</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {recentSpins.map((spin) => (
                  <div key={spin.id} className="space-y-2">
                    <div className={`p-2 rounded-lg text-center font-bold ${
                      getNumberColor(spin.winningNumber) === 'red' ? 'bg-red-600' :
                      getNumberColor(spin.winningNumber) === 'black' ? 'bg-gray-900' :
                      'bg-green-600'
                    }`}>
                      Kazanan: {spin.winningNumber}
                    </div>
                    {spin.results && spin.results.slice(0, 5).map((result, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg border text-sm ${
                          result.result === 'kazandı'
                            ? 'bg-green-500/10 border-green-500/50 text-green-400'
                            : 'bg-red-500/10 border-red-500/50 text-red-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{result.username}</span>
                          <span>
                            {result.result === 'kazandı' ? '+' : '-'}{result.amount.toFixed(0)}₺
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                {recentSpins.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    Henüz çevirme yok
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
