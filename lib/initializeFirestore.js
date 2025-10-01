// This file is for initializing Firestore collections
// Run this once to set up the roulette table

import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from './firebase'

export async function initializeRouletteTable() {
  const tableRef = doc(db, 'roulette-tables', 'main-table')
  const tableSnap = await getDoc(tableRef)
  
  if (!tableSnap.exists()) {
    await setDoc(tableRef, {
      isSpinning: false,
      winningNumber: null,
      rotation: 0,
      lastSpinTimestamp: null
    })
  }
}
