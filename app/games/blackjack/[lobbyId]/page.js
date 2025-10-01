'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  Timestamp,
  arrayUnion,
  arrayRemove,
  deleteField
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const suits = ['♠️', '♥️', '♣️', '♦️']
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

const createDeck = () => {
  const deck = []
  for (const suit of suits) {
    for (const value of values) {
      deck.push({ suit, value })
    }
  }
  return deck.sort(() => Math.random() - 0.5)
}

const calculateHandValue = (hand) => {
  let value = 0
  let aces = 0

  for (const card of hand) {
    if (card.value === 'A') {
      aces++
      value += 11
    } else if (['J', 'Q', 'K'].includes(card.value)) {
      value += 10
    } else {
      value += parseInt(card.value)
    }
  }

  while (value > 21 && aces > 0) {
    value -= 10
    aces--
  }

  return value
}

export default function BlackjackTable() {
  const params = useParams()
  const lobbyId = params.lobbyId
  const router = useRouter()

  const [user, setUser] = useState(null)
  const [username, setUsername] = useState('')
  const [balance, setBalance] = useState(0)
  const [lobby, setLobby] = useState(null)
  const [bet, setBet] = useState(10)
  const [hasJoined, setHasJoined] = useState(false)
  const [loading, setLoading] = useState(true)
  const [timer, setTimer] = useState(30)

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

  // Listen to lobby state
  useEffect(() => {
    if (!lobbyId) return

    const lobbyRef = doc(db, 'blackjack-lobbies', lobbyId)
    
    const unsubscribe = onSnapshot(lobbyRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data()
        setLobby(data)
        
        // Check if user has joined
        if (data.players) {
          const playerExists = data.players.some(p => p.userId === user?.uid)
          setHasJoined(playerExists)
        }
      } else {
        // Initialize lobby
        await setDoc(lobbyRef, {
          phase: 'waiting', // waiting, betting, playing, dealer, finished
          players: [],
          dealer: { hand: [], value: 0 },
          deck: createDeck(),
          activePlayerIndex: 0,
          roundTimer: 30,
          lastUpdate: Timestamp.now()
        })
      }
    })

    return () => unsubscribe()
  }, [lobbyId, user])

  // Game loop timer
  useEffect(() => {
    if (!lobby || !user) return

    const interval = setInterval(async () => {
      const lobbyRef = doc(db, 'blackjack-lobbies', lobbyId)
      const lobbySnap = await getDoc(lobbyRef)
      
      if (!lobbySnap.exists()) return
      
      const data = lobbySnap.data()
      const currentTimer = data.roundTimer || 30

      if (data.phase === 'waiting' && data.players && data.players.length > 0) {
        // Start betting phase after 5 seconds
        const lastUpdate = data.lastUpdate?.toDate() || new Date()
        const elapsed = (new Date() - lastUpdate) / 1000
        
        if (elapsed > 5) {
          await updateDoc(lobbyRef, {
            phase: 'betting',
            roundTimer: 10,
            lastUpdate: Timestamp.now()
          })
        }
      } else if (data.phase === 'betting') {
        if (currentTimer > 0) {
          await updateDoc(lobbyRef, {
            roundTimer: currentTimer - 1
          })
        } else {
          // Start dealing
          await startRound(lobbyRef, data)
        }
      } else if (data.phase === 'playing') {
        if (currentTimer > 0) {
          await updateDoc(lobbyRef, {
            roundTimer: currentTimer - 1
          })
        } else {
          // Auto-stand for current player
          await handleStand(lobbyRef, data)
        }
      }

      setTimer(currentTimer)
    }, 1000)

    return () => clearInterval(interval)
  }, [lobby, lobbyId, user])

  const startRound = async (lobbyRef, data) => {
    try {
      const newDeck = createDeck()
      const players = data.players.map((player, index) => {
        if (!player.bet || player.bet < 10) {
          return { ...player, bet: 10, hand: [], value: 0, status: 'playing' }
        }
        
        // Deal 2 cards to each player
        const card1 = newDeck.pop()
        const card2 = newDeck.pop()
        const hand = [card1, card2]
        const value = calculateHandValue(hand)
        
        return {
          ...player,
          hand,
          value,
          status: value === 21 ? 'blackjack' : 'playing'
        }
      })

      // Deal 2 cards to dealer (only show 1)
      const dealerCard1 = newDeck.pop()
      const dealerCard2 = newDeck.pop()
      const dealerHand = [dealerCard1, dealerCard2]

      await updateDoc(lobbyRef, {
        phase: 'playing',
        players,
        dealer: { hand: dealerHand, value: 0 },
        deck: newDeck,
        activePlayerIndex: 0,
        roundTimer: 30,
        lastUpdate: Timestamp.now()
      })
    } catch (error) {
      console.error('Start round error:', error)
    }
  }

  const joinTable = async () => {
    if (!user || !lobby) return

    if (lobby.players && lobby.players.length >= 4) {
      alert('Masa dolu!')
      return
    }

    if (bet > balance) {
      alert('Yetersiz bakiye!')
      return
    }

    try {
      const lobbyRef = doc(db, 'blackjack-lobbies', lobbyId)
      
      await updateDoc(lobbyRef, {
        players: arrayUnion({
          userId: user.uid,
          username: username,
          bet: bet,
          hand: [],
          value: 0,
          status: 'waiting'
        }),
        lastUpdate: Timestamp.now()
      })

      // Deduct bet from balance
      const newBalance = balance - bet
      setBalance(newBalance)
      await updateDoc(doc(db, 'users', user.uid), {
        virtualCurrencyBalance: newBalance
      })

      setHasJoined(true)
    } catch (error) {
      console.error('Join error:', error)
    }
  }

  const handleHit = async (lobbyRef, data) => {
    const activePlayer = data.players[data.activePlayerIndex]
    if (activePlayer.userId !== user.uid) return

    try {
      const newDeck = [...data.deck]
      const newCard = newDeck.pop()
      const newHand = [...activePlayer.hand, newCard]
      const newValue = calculateHandValue(newHand)

      const updatedPlayers = [...data.players]
      updatedPlayers[data.activePlayerIndex] = {
        ...activePlayer,
        hand: newHand,
        value: newValue,
        status: newValue > 21 ? 'bust' : newValue === 21 ? 'stand' : 'playing'
      }

      await updateDoc(lobbyRef, {
        players: updatedPlayers,
        deck: newDeck
      })

      // If bust or 21, move to next player
      if (newValue >= 21) {
        await advanceTurn(lobbyRef, updatedPlayers, data)
      }
    } catch (error) {
      console.error('Hit error:', error)
    }
  }

  const handleStand = async (lobbyRef, data) => {
    try {
      const updatedPlayers = [...data.players]
      updatedPlayers[data.activePlayerIndex] = {
        ...updatedPlayers[data.activePlayerIndex],
        status: 'stand'
      }

      await updateDoc(lobbyRef, {
        players: updatedPlayers
      })

      await advanceTurn(lobbyRef, updatedPlayers, data)
    } catch (error) {
      console.error('Stand error:', error)
    }
  }

  const advanceTurn = async (lobbyRef, players, data) => {
    // Find next player who is still playing
    let nextIndex = data.activePlayerIndex + 1
    
    while (nextIndex < players.length) {
      if (players[nextIndex].status === 'playing') {
        await updateDoc(lobbyRef, {
          activePlayerIndex: nextIndex,
          roundTimer: 30
        })
        return
      }
      nextIndex++
    }

    // No more players, dealer's turn
    await playDealer(lobbyRef, data)
  }

  const playDealer = async (lobbyRef, data) => {
    try {
      await updateDoc(lobbyRef, {
        phase: 'dealer'
      })

      let dealerHand = [...data.dealer.hand]
      let dealerValue = calculateHandValue(dealerHand)
      let newDeck = [...data.deck]

      // Dealer draws until 17 or higher
      while (dealerValue < 17) {
        const newCard = newDeck.pop()
        dealerHand.push(newCard)
        dealerValue = calculateHandValue(dealerHand)
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        await updateDoc(lobbyRef, {
          dealer: { hand: dealerHand, value: dealerValue },
          deck: newDeck
        })
      }

      // Calculate winners
      setTimeout(() => finishRound(lobbyRef, dealerValue), 2000)
    } catch (error) {
      console.error('Dealer error:', error)
    }
  }

  const finishRound = async (lobbyRef, dealerValue) => {
    try {
      const lobbySnap = await getDoc(lobbyRef)
      const data = lobbySnap.data()

      // Update player balances
      for (const player of data.players) {
        let winAmount = 0

        if (player.status === 'blackjack' && dealerValue !== 21) {
          winAmount = player.bet * 2.5
        } else if (player.status === 'bust') {
          winAmount = 0
        } else if (player.status === 'stand') {
          if (dealerValue > 21 || player.value > dealerValue) {
            winAmount = player.bet * 2
          } else if (player.value === dealerValue) {
            winAmount = player.bet
          }
        }

        if (winAmount > 0) {
          const userRef = doc(db, 'users', player.userId)
          const userSnap = await getDoc(userRef)
          if (userSnap.exists()) {
            const currentBalance = userSnap.data().virtualCurrencyBalance || 0
            await updateDoc(userRef, {
              virtualCurrencyBalance: currentBalance + winAmount
            })
            
            if (player.userId === user.uid) {
              setBalance(currentBalance + winAmount)
            }
          }
        }
      }

      await updateDoc(lobbyRef, {
        phase: 'finished',
        roundTimer: 5
      })

      setTimeout(async () => {
        await updateDoc(lobbyRef, {
          phase: 'waiting',
          players: [],
          dealer: { hand: [], value: 0 },
          deck: createDeck(),
          activePlayerIndex: 0,
          roundTimer: 30,
          lastUpdate: Timestamp.now()
        })
      }, 5000)

    } catch (error) {
      console.error('Finish round error:', error)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Yükleniyor...</p>
      </div>
    )
  }

  const lobbyRef = lobby ? doc(db, 'blackjack-lobbies', lobbyId) : null
  const activePlayer = lobby?.players?.[lobby.activePlayerIndex]
  const isMyTurn = activePlayer?.userId === user?.uid
  const myPlayer = lobby?.players?.find(p => p.userId === user?.uid)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/games/blackjack">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Lobiye Dön
            </Button>
          </Link>
          
          <div className="text-center">
            <h1 className="font-headline text-3xl font-bold">🃏 {lobbyId.toUpperCase()}</h1>
            {lobby && (
              <p className="text-muted-foreground">
                {lobby.phase === 'waiting' && 'Oyuncular bekleniyor...'}
                {lobby.phase === 'betting' && `Bahis Süresi: ${timer}s`}
                {lobby.phase === 'playing' && isMyTurn && `Sizin sıranız! ${timer}s`}
                {lobby.phase === 'playing' && !isMyTurn && `${activePlayer?.username} düşünüyor...`}
                {lobby.phase === 'dealer' && 'Krupiye oynuyor...'}
                {lobby.phase === 'finished' && 'El bitti!'}
              </p>
            )}
          </div>

          <div className="text-right">
            <div className="text-sm text-muted-foreground">Bakiye</div>
            <div className="text-xl font-bold text-primary">{balance.toFixed(2)}₺</div>
          </div>
        </div>

        {/* Dealer */}
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-center">🎩 Krupiye</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center gap-2">
              {lobby?.dealer?.hand?.map((card, index) => (
                <div
                  key={index}
                  className={`w-20 h-28 rounded-lg border-2 border-primary flex flex-col items-center justify-center text-2xl font-bold ${
                    card.suit === '♥️' || card.suit === '♦️' ? 'text-red-500' : 'text-white'
                  } bg-card`}
                >
                  {(lobby.phase === 'betting' || lobby.phase === 'playing') && index === 1 ? (
                    <div className="text-4xl">🂠</div>
                  ) : (
                    <>
                      <div>{card.value}</div>
                      <div>{card.suit}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
            {(lobby?.phase === 'dealer' || lobby?.phase === 'finished') && (
              <div className="text-center mt-4 text-xl font-bold">
                Değer: {lobby.dealer.value}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Players */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((index) => {
            const player = lobby?.players?.[index]
            const isActive = lobby?.activePlayerIndex === index && lobby?.phase === 'playing'

            return (
              <Card
                key={index}
                className={`${isActive ? 'ring-2 ring-primary' : ''} ${
                  player?.userId === user?.uid ? 'border-primary' : ''
                }`}
              >
                <CardHeader>
                  <CardTitle className="text-lg">
                    {player ? (
                      <div className="flex items-center justify-between">
                        <span>{player.username}</span>
                        {player.userId === user?.uid && <span className="text-primary">YOU</span>}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Boş Koltuk</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {player && (
                    <>
                      <div className="flex justify-center gap-1 mb-4">
                        {player.hand?.map((card, cardIndex) => (
                          <div
                            key={cardIndex}
                            className={`w-16 h-20 rounded border-2 flex flex-col items-center justify-center text-lg font-bold ${
                              card.suit === '♥️' || card.suit === '♦️' ? 'text-red-500' : 'text-white'
                            } bg-card border-border`}
                          >
                            <div>{card.value}</div>
                            <div>{card.suit}</div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Bahis:</span>
                          <span className="font-bold">{player.bet}₺</span>
                        </div>
                        {player.hand && player.hand.length > 0 && (
                          <div className="flex justify-between">
                            <span>Değer:</span>
                            <span className="font-bold">{player.value}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Durum:</span>
                          <span className={`font-bold ${
                            player.status === 'blackjack' ? 'text-yellow-400' :
                            player.status === 'bust' ? 'text-red-400' :
                            player.status === 'stand' ? 'text-blue-400' :
                            'text-green-400'
                          }`}>
                            {player.status === 'blackjack' && '🎉 Blackjack!'}
                            {player.status === 'bust' && '💥 Battı!'}
                            {player.status === 'stand' && '✋ Durdu'}
                            {player.status === 'playing' && '🎮 Oynuyor'}
                            {player.status === 'waiting' && '⏳ Bekliyor'}
                          </span>
                        </div>
                      </div>

                      {isMyTurn && (
                        <div className="flex gap-2 mt-4">
                          <Button onClick={() => handleHit(lobbyRef, lobby)} className="flex-1">
                            Kart Çek
                          </Button>
                          <Button onClick={() => handleStand(lobbyRef, lobby)} variant="secondary" className="flex-1">
                            Dur
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Join Table */}
        {!hasJoined && lobby?.phase === 'waiting' && (
          <Card>
            <CardHeader>
              <CardTitle>Masaya Katıl</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bet">Bahis Miktarı (₺)</Label>
                <Input
                  id="bet"
                  type="number"
                  min="10"
                  max={balance}
                  value={bet}
                  onChange={(e) => setBet(Number(e.target.value))}
                />
              </div>
              <Button onClick={joinTable} className="w-full">
                Katıl ({bet}₺)
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
