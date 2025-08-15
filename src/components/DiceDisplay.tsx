import React, { useEffect, useState } from 'react';

interface DiceDisplayProps {
  dice: number[];
  isRolling: boolean;
  round: number;
  pointsScored?: number;
  isBunco?: boolean;
  isTripleOnes?: boolean;
  lastRollTimestamp?: number;
}

const DiceDisplay: React.FC<DiceDisplayProps> = ({ 
  dice, 
  isRolling, 
  round, 
  pointsScored, 
  isBunco, 
  isTripleOnes,
  lastRollTimestamp
}) => {
  const [rollingDice, setRollingDice] = useState<number[]>([1, 1, 1]);
  const [animationKey, setAnimationKey] = useState(0);
  const [showBounce, setShowBounce] = useState(false);
  const [showShake, setShowShake] = useState(false);
  const [showGlow, setShowGlow] = useState(false);
  const [lastProcessedTimestamp, setLastProcessedTimestamp] = useState<number | null>(null);

  // Update rolling dice when animation starts
  useEffect(() => {
    if (isRolling) {
      setAnimationKey(prev => prev + 1);
      // Generate random dice for rolling animation
      setRollingDice([1, 2, 3].map(() => Math.ceil(Math.random() * 6)));
    }
  }, [isRolling]);

  // Update to final dice when rolling stops
  useEffect(() => {
    if (!isRolling) {
      setRollingDice(dice);
    }
  }, [dice, isRolling]);

  // Show different animations based on roll results
  useEffect(() => {
    if (!isRolling && pointsScored !== undefined && pointsScored !== null && lastRollTimestamp) {
      // Only process if this is a new roll (timestamp changed)
      if (lastProcessedTimestamp !== lastRollTimestamp) {
        setLastProcessedTimestamp(lastRollTimestamp);
        
        if (isBunco) {
          setShowGlow(true);
          const timer = setTimeout(() => setShowGlow(false), 2000);
          return () => clearTimeout(timer);
        } else if (pointsScored > 0) {
          setShowBounce(true);
          const timer = setTimeout(() => setShowBounce(false), 600);
          return () => clearTimeout(timer);
        } else if (pointsScored === 0) {
          setShowShake(true);
          const timer = setTimeout(() => setShowShake(false), 500);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [pointsScored, isRolling, isBunco, lastRollTimestamp, lastProcessedTimestamp]);

  const getDiceFace = (value: number) => {
    const dots = [];
    const positions = {
      1: [[1, 1]],
      2: [[0, 0], [2, 2]],
      3: [[0, 0], [1, 1], [2, 2]],
      4: [[0, 0], [0, 2], [2, 0], [2, 2]],
      5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
      6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]]
    };

    const pos = positions[value as keyof typeof positions] || [];
    
    return (
      <div className="dice-face">
        {pos.map(([row, col], index) => (
          <div
            key={index}
            className="dice-dot"
            style={{
              gridRow: row + 1,
              gridColumn: col + 1,
            }}
          />
        ))}
      </div>
    );
  };

  const displayDice = isRolling ? rollingDice : dice;

  const getAnimationClass = () => {
    if (isRolling) return 'rolling';
    if (showGlow) return 'glow';
    if (showBounce) return 'bounce';
    if (showShake) return 'shake';
    return '';
  };

  const getDiceClass = (value: number) => {
    let baseClass = `dice ${getAnimationClass()}`;
    const targetNumber = round % 6 || 6; // Ensures target is 1-6
    
    if (isTripleOnes && value === 1) {
      baseClass += ' triple-ones';
    } else if (value === targetNumber) {
      baseClass += ' target-number';
    }
    return baseClass;
  };

  const getResultText = () => {
    if (isBunco) return '🎉 BUNCO! +21 points!';
    if (isTripleOnes) return '💥 Triple Ones! Team points reset!';
    if (pointsScored && pointsScored > 0) return `+${pointsScored} points!`;
    if (pointsScored === 0) return 'No points scored';
    return null;
  };

  const getResultColor = () => {
    if (isBunco) return 'text-yellow-400';
    if (isTripleOnes) return 'text-red-400';
    if (pointsScored && pointsScored > 0) return 'text-green-400';
    if (pointsScored === 0) return 'text-gray-400';
    return 'text-white';
  };

  return (
    <div className="dice-container">
      <div className="dice-label">🎲 Round {round}</div>
      <div className="dice-row">
        {displayDice.map((value, index) => (
          <div
            key={`${animationKey}-${index}`}
            className={getDiceClass(value)}
            data-value={value}
            style={{
              animationDelay: isRolling ? `${index * 0.1}s` : '0s',
              animationDuration: isRolling ? '0.6s' : '0.3s'
            }}
          >
            {getDiceFace(value)}
          </div>
        ))}
      </div>
      {isRolling && (
        <div className="rolling-text">Rolling...</div>
      )}
      {!isRolling && getResultText() && (
        <div className={`font-semibold text-sm ${getResultColor()}`}>
          {getResultText()}
        </div>
      )}
    </div>
  );
};

export default DiceDisplay; 