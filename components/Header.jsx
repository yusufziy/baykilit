'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Snowflake, LogOut, User } from 'lucide-react'

export default function Header() {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState('')
  const [balance, setBalance] = useState(0)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
        if (userDoc.exists()) {
          const data = userDoc.data()
          setUsername(data.username)
          setBalance(data.virtualCurrencyBalance || 0)
        }
      } else {
        setUser(null)
        setUsername('')
        setBalance(0)
      }
    })

    return () => unsubscribe()
  }, [])

  const handleLogout = async () => {
    await signOut(auth)
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-headline text-xl font-bold">
            <Snowflake className="h-6 w-6 text-primary" />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Baykilit
            </span>
          </Link>

          {user && (
            <nav className="hidden md:flex items-center gap-4">
              <Link href="/games">
                <Button variant="ghost" className="text-foreground/80 hover:text-foreground">
                  Oyunlar
                </Button>
              </Link>
              <Link href="/vote">
                <Button variant="ghost" className="text-foreground/80 hover:text-foreground">
                  Oylama
                </Button>
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary">
                <span className="text-sm text-muted-foreground">Bakiye:</span>
                <span className="font-bold text-primary">{balance.toFixed(2)} ₺</span>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar>
                      <AvatarImage src={`https://api.dicebear.com/7.x/bottts/svg?seed=${username}`} />
                      <AvatarFallback>{username?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{username}</p>
                      <p className="text-xs text-muted-foreground">{balance.toFixed(2)} ₺</p>
                    </div>
                  </div>
                  <DropdownMenuItem onClick={() => router.push('/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    Profil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Çıkış Yap
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link href="/login">
              <Button variant="default">Giriş Yap</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}