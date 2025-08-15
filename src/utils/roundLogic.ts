import { collection, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function checkHeadTableForRoundEnd(gameCode: string): Promise<void> {
  const tableDoc = await getDoc(doc(db, 'games', gameCode, 'tables', "0"));
  if (tableDoc.exists() && tableDoc.data().roundOver) {
    console.log("⏹️ Head table already marked roundOver — skipping check.");
    return;
  }

  const gameDoc = await getDoc(doc(db, 'games', gameCode));
  if (gameDoc.exists() && gameDoc.data().nextRoundReady) {
    console.log("⏹️ nextRoundReady already true — skipping redundant round end trigger.");
    return;
  }

  const playersSnap = await getDocs(collection(db, 'games', gameCode, 'players'));
  const teamScores = [0, 0];

  playersSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.table === 0) {
      const team = data.seat % 2;
      teamScores[team] += data.pointsThisRound || 0;
    }
  });

  console.log('📊 [checkHeadTable] Team scores:', teamScores);

  const maxScore = Math.max(...teamScores);
    if (maxScore >= 21) {
    const tablesSnap = await getDocs(collection(db, 'games', gameCode, 'tables'));
    const updates = tablesSnap.docs.map((doc) =>
        updateDoc(doc.ref, { roundOver: true })
    );
    await Promise.all(updates);

    // 🟡 Signal that the next round is ready (host will see a button)
    await updateDoc(doc(db, 'games', gameCode), {
        nextRoundReady: true,
    });

    console.log('✅ Round over triggered + nextRoundReady set!');
    }
}
