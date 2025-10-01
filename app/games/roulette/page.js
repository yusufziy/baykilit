'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  Timestamp,
  writeBatch,
  deleteDoc,
  getDocs
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { initializeRouletteTable } from '@/lib/initializeFirestore'

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
  const [isSpinning, setIsSpinning] = useState(false)
  const [winningNumber, setWinningNumber] = useState(null)
  const [rotation, setRotation] = useState(0)
  const [message, setMessage] = useState('')
  const [recentSpins, setRecentSpins] = useState([])
  const [loading, setLoading] = useState(true)
  const [bettingTime, setBettingTime] = useState(30)
  const [isBettingPhase, setIsBettingPhase] = useState(true)
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
        
        // Initialize roulette table
        await initializeRouletteTable()
        
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  useEffect(() => {
    // Listen to roulette table state
    const tableRef = doc(db, 'roulette-tables', TABLE_ID)
    const unsubscribe = onSnapshot(tableRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data()
        setIsSpinning(data.isSpinning || false)
        setWinningNumber(data.winningNumber)
        setRotation(data.rotation || 0)
      }
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    // Listen to recent spins
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
    if (isSpinning) return
    
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num))
    } else {
      setSelectedNumbers([...selectedNumbers, num])
    }
    setSelectedOption(null)
  }

  const handleOptionSelect = (option) => {
    if (isSpinning) return
    setSelectedOption(option)
    setSelectedNumbers([])
  }

  const placeBet = async () => {
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
      // Place bet in Firestore
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

      await addDoc(collection(db, `roulette-tables/${TABLE_ID}/bets`), betData)

      setMessage('Bahis yerleştirildi! ✅')
      
      // Deduct from balance
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
    if (isSpinning) return

    try {
      // Generate winning number
      const winning = Math.floor(Math.random() * 37)
      
      // Calculate rotation angle for the winning number
      const anglePerNumber = 360 / 37
      const targetAngle = winning * anglePerNumber
      const fullRotations = 5 * 360
      const finalRotation = fullRotations + targetAngle

      // Update table state
      await updateDoc(doc(db, 'roulette-tables', TABLE_ID), {
        isSpinning: true,
        rotation: finalRotation,
        lastSpinTimestamp: Timestamp.now()
      })

      // Wait for animation
      setTimeout(async () => {
        // Set winning number
        await updateDoc(doc(db, 'roulette-tables', TABLE_ID), {
          isSpinning: false,
          winningNumber: winning
        })

        // Process all bets
        await processBets(winning)
      }, 5500)

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

        // Delete bet
        batch.delete(betDoc.ref)

        // Update user balance if won
        if (won) {
          const userRef = doc(db, 'users', betData.userId)
          batch.update(userRef, {
            virtualCurrencyBalance: (betData.balance || 0) + payout
          })
        }
      })

      await batch.commit()

      // Save spin result
      await addDoc(collection(db, 'roulette-spins'), {
        winningNumber: winning,
        results: results,
        timestamp: Timestamp.now()
      })

      // Update own balance if won
      const myResult = results.find(r => r.userId === user.uid)
      if (myResult && myResult.result === 'kazandı') {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists()) {
          setBalance(userDoc.data().virtualCurrencyBalance || 0)
          setMessage(`🎉 KAZANDINIZ! +${myResult.amount.toFixed(2)}₺`)
        }
      } else {
        setMessage('Kaybettiniz! 😔')
      }

      // Clear selections
      setSelectedNumbers([])
      setSelectedOption(null)

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
              <CardTitle className="font-headline text-3xl text-center">🎰 Roulette</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Wheel */}
              <div className="relative w-80 h-80 mx-auto">
                {/* Wheel Container */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Outer rim */}
                  <div className="absolute inset-0 rounded-full border-8 border-amber-600 shadow-2xl"></div>
                  
                  {/* Rotating wheel with numbers */}
                  <div
                    className="absolute inset-4 rounded-full overflow-hidden transition-transform duration-[5000ms] ease-out"
                    style={{ transform: `rotate(${rotation}deg)` }}
                  >
                    {/* Generate wheel segments */}
                    {[0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26].map((num, index) => {
                      const angle = (index * 360) / 37
                      const color = getNumberColor(num)
                      const bgColor = color === 'red' ? 'bg-red-600' : color === 'black' ? 'bg-black' : 'bg-green-600'
                      
                      return (
                        <div
                          key={num}
                          className={`absolute inset-0 ${bgColor}`}
                          style={{
                            clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((angle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((angle - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((angle + 360/37 - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((angle + 360/37 - 90) * Math.PI / 180)}%)`
                          }}
                        >
                          <div
                            className="absolute text-white font-bold text-xs"
                            style={{
                              top: '15%',
                              left: '50%',
                              transform: `translate(-50%, 0) rotate(${angle + 90}deg)`,
                            }}
                          >
                            {num}
                          </div>
                        </div>
                      )
                    })}
                    
                    {/* Center circle */}
                    <div className="absolute inset-[35%] rounded-full bg-amber-700 border-4 border-amber-500 shadow-inner"></div>
                  </div>
                  
                  {/* Pointer indicator at top */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
                    <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-yellow-400 drop-shadow-lg"></div>
                  </div>
                </div>

                {/* Result Display */}
                {winningNumber !== null && (
                  <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-center">
                    <div className={`px-6 py-3 rounded-lg font-bold text-2xl shadow-lg ${
                      getNumberColor(winningNumber) === 'red' ? 'bg-red-500' :
                      getNumberColor(winningNumber) === 'black' ? 'bg-black' : 'bg-green-500'
                    }`}>
                      {winningNumber}
                    </div>
                  </div>
                )}
              </div>

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

              {/* Number Grid */}
              <div>
                <h3 className="font-headline font-bold mb-2">Sayılar</h3>
                <div className="grid grid-cols-12 gap-1">
                  <div
                    onClick={() => handleNumberSelect(0)}
                    className={`col-span-12 h-12 flex items-center justify-center rounded font-bold cursor-pointer border-2 transition-all ${
                      selectedNumbers.includes(0)
                        ? 'border-primary bg-primary/20'
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
                        className={`col-span-4 h-12 flex items-center justify-center rounded font-bold cursor-pointer border-2 transition-all ${
                          selectedNumbers.includes(num)
                            ? 'border-primary bg-primary/20'
                            : color === 'red'
                            ? 'border-border bg-red-600 hover:bg-red-500'
                            : 'border-border bg-black hover:bg-gray-800'
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
                    disabled={isSpinning}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={placeBet} disabled={isSpinning} className="flex-1">
                    Bahis Yerleştir
                  </Button>
                  <Button onClick={spinWheel} disabled={isSpinning} variant="default" className="flex-1">
                    {isSpinning ? 'Çevriliyor...' : '🎰 ÇEVİR'}
                  </Button>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  Bakiyeniz: <span className="font-bold text-primary">{balance.toFixed(2)}₺</span>
                </div>
              </div>
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
                    <div className="p-2 rounded-lg bg-secondary text-center font-bold">
                      Kazanan: {spin.winningNumber}
                    </div>
                    {spin.results && spin.results.map((result, idx) => (
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
                            {result.result === 'kazandı' ? '+' : '-'}{result.amount.toFixed(2)}₺
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
