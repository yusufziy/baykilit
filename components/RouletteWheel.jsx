'use client'

export default function RouletteWheel({ rotation, winningNumber }) {
  // European roulette order
  const wheelOrder = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
  
  const getNumberColor = (num) => {
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
    if (num === 0) return 'green'
    return redNumbers.includes(num) ? 'red' : 'black'
  }

  return (
    <div className="relative w-80 h-80 mx-auto">
      {/* Outer Frame */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-700 to-amber-900 shadow-2xl"></div>
      <div className="absolute inset-2 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 shadow-inner"></div>
      
      {/* Spinning Wheel */}
      <div 
        className="absolute inset-6 rounded-full transition-transform ease-out"
        style={{ 
          transform: `rotate(${rotation}deg)`,
          transitionDuration: rotation > 0 ? '5000ms' : '0ms'
        }}
      >
        {/* Wheel segments */}
        <div className="relative w-full h-full">
          {wheelOrder.map((num, index) => {
            const angle = (index * 360) / 37
            const color = getNumberColor(num)
            
            return (
              <div
                key={`${num}-${index}`}
                className="absolute inset-0"
                style={{
                  transform: `rotate(${angle}deg)`
                }}
              >
                {/* Colored segment */}
                <div 
                  className={`absolute top-0 left-1/2 origin-bottom -translate-x-1/2 ${
                    color === 'red' ? 'bg-red-600' : 
                    color === 'black' ? 'bg-gray-900' : 
                    'bg-green-600'
                  }`}
                  style={{
                    width: '50px',
                    height: '50%',
                    clipPath: 'polygon(35% 0%, 65% 0%, 50% 100%)'
                  }}
                >
                  {/* Number */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 text-white font-bold text-base">
                    {num}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Center decorative circle */}
        <div className="absolute inset-[30%] rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 shadow-lg flex items-center justify-center">
          <div className="text-2xl font-bold text-amber-900">🎰</div>
        </div>
      </div>
      
      {/* Ball indicator at top */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <div className="w-4 h-4 rounded-full bg-white shadow-lg border-2 border-gray-300"></div>
      </div>
      
      {/* Winning number display */}
      {winningNumber !== null && (
        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 text-center">
          <div className={`px-8 py-4 rounded-lg font-bold text-3xl shadow-xl ${
            getNumberColor(winningNumber) === 'red' ? 'bg-red-500 text-white' :
            getNumberColor(winningNumber) === 'black' ? 'bg-gray-900 text-white' : 
            'bg-green-500 text-white'
          }`}>
            {winningNumber}
          </div>
        </div>
      )}
    </div>
  )
}
