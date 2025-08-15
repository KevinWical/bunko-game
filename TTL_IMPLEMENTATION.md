# Client-Side TTL Implementation

This implementation provides automatic cleanup of expired game data without requiring Firebase Functions or paid billing plans.

## How It Works

### 1. **Automatic Cleanup**
- Runs every 5 minutes when the app is active
- Deletes games older than 8 hours
- Uses the `createdAt` field to determine age

### 2. **Expiration Check**
- Prevents loading data from expired games
- Checks `createdAt` timestamp before processing game data
- Logs when expired games are detected

### 3. **TTL Fields**
All game documents now include:
- `_ttl`: Timestamp for when document should expire (8 hours from creation)
- `createdAt`: Timestamp when document was created

## Files Modified

### `src/utils/ttlCleanup.ts` (New)
- `cleanupExpiredGames()`: Deletes expired games
- `isGameExpired()`: Checks if a game is expired
- `startPeriodicCleanup()`: Starts automatic cleanup

### `src/App.tsx`
- Added TTL cleanup on app startup
- Runs cleanup every 5 minutes

### `src/hooks/useFirestoreGame.ts`
- Added expiration check before loading game data
- Prevents joining expired games

### `src/firebase.ts`
- Added TTL configuration
- `createDocumentWithTTL()` helper function

### `src/components/GameRoom.tsx`
- All document creation now includes TTL fields

## Benefits

✅ **Free**: No Firebase Functions required  
✅ **Automatic**: Runs cleanup every 5 minutes  
✅ **Efficient**: Only processes when app is active  
✅ **Safe**: Checks expiration before loading data  
✅ **Clean**: Removes old games automatically  

## Configuration

To change the TTL duration, modify:
- `TTL_DURATION_MS` in `src/utils/ttlCleanup.ts`
- `GAME_TTL_SECONDS` in `src/firebase.ts`

## Testing

1. Create a game
2. Check Firebase Console - documents should have `_ttl` and `createdAt` fields
3. Wait 8 hours (or temporarily reduce TTL for testing)
4. Games should be automatically deleted

## Firestore Index

Make sure you have the composite index:
- Collection: `games`
- Fields: 
  - `_ttl` (Ascending)
  - `createdAt` (Ascending)
- Query scope: Collection

This implementation provides the same TTL functionality as Firebase Functions but works entirely on the client side! 