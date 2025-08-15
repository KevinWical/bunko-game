import { db } from '../firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

// TTL duration in milliseconds (8 hours)
const TTL_DURATION_MS = 8 * 60 * 60 * 1000;

export const cleanupExpiredGames = async () => {
  try {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - TTL_DURATION_MS);
    
    // Query for games older than 8 hours
    const gamesRef = collection(db, 'games');
    const q = query(
      gamesRef,
      where('createdAt', '<', cutoffTime)
    );
    
    const snapshot = await getDocs(q);
    let deletedCount = 0;
    
    // Delete expired games and their subcollections
    for (const gameDoc of snapshot.docs) {
      try {
        // Delete the main game document
        await deleteDoc(gameDoc.ref);
        deletedCount++;
        console.log(`Deleted expired game: ${gameDoc.id}`);
      } catch (error) {
        console.error(`Error deleting game ${gameDoc.id}:`, error);
      }
    }
    
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} expired games`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error('Error during TTL cleanup:', error);
    return 0;
  }
};

// Check if a game document is expired
export const isGameExpired = (createdAt: Date): boolean => {
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - TTL_DURATION_MS);
  return createdAt < cutoffTime;
};

// Cleanup expired games periodically (every 5 minutes when app is active)
export const startPeriodicCleanup = () => {
  // Run cleanup immediately
  cleanupExpiredGames();
  
  // Then run every 5 minutes
  const interval = setInterval(cleanupExpiredGames, 5 * 60 * 1000);
  
  // Return cleanup function
  return () => clearInterval(interval);
}; 