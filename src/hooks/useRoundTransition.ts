import { collection, getDocs, getDoc, updateDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { FirestorePlayer } from './useFirestoreGame';
import type { TableData } from './useTableData';

export async function transitionToNextRound(gameCode: string) {
  try {
    // Set round transition flag to prevent bot turns during transition
    await updateDoc(doc(db, 'games', gameCode), {
      roundTransitionInProgress: true
    });
    console.log('🔄 Round transition started - setting roundTransitionInProgress flag');

    // 1. Load players and tables
    const playersSnap = await getDocs(collection(db, 'games', gameCode, 'players'));
    const tablesSnap = await getDocs(collection(db, 'games', gameCode, 'tables'));

    const players: FirestorePlayer[] = playersSnap.docs.map((doc) => ({
      ...(doc.data() as FirestorePlayer),
      id: doc.id, 
    }));
    console.log("🎯 Players loaded for reseating:", players.map(p => `${p.name} (${p.id})`));
    console.log("🔍 Player details:", players.map(p => ({
      id: p.id,
      name: p.name,
      table: p.table,
      seat: p.seat,
      pointsThisRound: p.pointsThisRound
    })));

    const tables: TableData[] = tablesSnap.docs.map((doc) => ({ ...(doc.data() as TableData), id: Number(doc.id) }));

    console.log("📋 Table structure:");
    tables.forEach(table => {
      console.log(`  Table ${table.id}: ${table.playerIds?.length || 0} players`);
    });

    // Debounce
    const gameDoc = await getDoc(doc(db, 'games', gameCode));
    if (gameDoc.exists() && gameDoc.data().nextRoundReady === false) {
      console.log("⏸️ Not ready to transition — nextRoundReady is false");
      return;
    }

    // 2. Group players by table
    const playersByTable: Record<number, FirestorePlayer[]> = {};
    players.forEach((player) => {
      if (!playersByTable[player.table]) playersByTable[player.table] = [];
      playersByTable[player.table].push(player);
    });

    // 3. Determine winners and create movement plan
    const winners = new Set<string>();
    const tableResults: Array<{
      tableId: number;
      winningTeam: number;
      team0Players: FirestorePlayer[];
      team1Players: FirestorePlayer[];
      team0Score: number;
      team1Score: number;
    }> = [];

    for (const table of tables) {
      const playersAtTable = playersByTable[table.id] || [];
      const team0Players = playersAtTable.filter(p => p.seat % 2 === 0);
      const team1Players = playersAtTable.filter(p => p.seat % 2 === 1);
      
      const team0Score = team0Players.reduce((sum, p) => sum + (p.pointsThisRound || 0), 0);
      const team1Score = team1Players.reduce((sum, p) => sum + (p.pointsThisRound || 0), 0);

      // Handle ties - in Bunco, ties typically go to the team that reached the score first
      // For simplicity, we'll use team 0 as winner in ties
      const winningTeam = team0Score >= team1Score ? 0 : 1;
      
      const winningPlayers = winningTeam === 0 ? team0Players : team1Players;
      winningPlayers.forEach(player => winners.add(player.id));

      tableResults.push({
        tableId: table.id,
        winningTeam,
        team0Players,
        team1Players,
        team0Score,
        team1Score
      });

      console.log(`📊 Table ${table.id}: Team 0 (${team0Score}) vs Team 1 (${team1Score}) - Team ${winningTeam} wins`);
    }

    // 4. Update roundsWon+totalPoints and reset points
    await Promise.all(players.map((p) =>
      updateDoc(doc(db, 'games', gameCode, 'players', p.id), {
        roundsWon: winners.has(p.id) ? p.roundsWon + 1 : p.roundsWon,
        totalPoints: p.totalPoints + (p.pointsThisRound || 0),
        pointsThisRound: 0,
      })
    ));

    // 5. Create new seating arrangement following Bunco rules
    const totalTables = tables.length;
    const newSeating: Record<number, FirestorePlayer[]> = {};

    // Initialize empty tables
    for (let i = 0; i < totalTables; i++) {
      newSeating[i] = [];
    }

    console.log("🔄 Starting seating assignment process...");

    // First, collect all players who need to be moved
    const allMovers: FirestorePlayer[] = [];
    const allStayers: FirestorePlayer[] = [];

    // Process each table's results to determine who moves and who stays
    for (let tableId = 0; tableId < totalTables; tableId++) {
      const result = tableResults.find(r => r.tableId === tableId);
      if (!result) continue;

      const { winningTeam, team0Players, team1Players } = result;
      const winningTeamPlayers = winningTeam === 0 ? team0Players : team1Players;
      const losingTeamPlayers = winningTeam === 0 ? team1Players : team0Players;

      console.log(`📋 Table ${tableId} processing:`);
      console.log(`   Winners (Team ${winningTeam}):`, winningTeamPlayers.map(p => p.name));
      console.log(`   Losers (Team ${1-winningTeam}):`, losingTeamPlayers.map(p => p.name));

      // Determine who stays and who moves based on table position
      let stayers: FirestorePlayer[];
      let movers: FirestorePlayer[];

      if (tableId === 0) {
        // Head table: winners stay, losers move
        stayers = winningTeamPlayers;
        movers = losingTeamPlayers;
        console.log(`   🏆 Head table: winners stay, losers move`);
      } else {
        // Other tables: losers stay, winners move
        stayers = losingTeamPlayers;
        movers = winningTeamPlayers;
        console.log(`   📍 Other table: losers stay, winners move`);
      }

      console.log(`   Staying:`, stayers.map(p => p.name));
      console.log(`   Moving:`, movers.map(p => p.name));

      // Add stayers to their current table
      allStayers.push(...stayers);
      
      // Add movers to the global movers list
      allMovers.push(...movers);
    }

    // Shuffle the movers to randomize team assignments
    const shuffledMovers = [...allMovers].sort(() => Math.random() - 0.5);
    console.log("🔄 Shuffled movers:", shuffledMovers.map(p => p.name));

    // Assign stayers to their current tables (seats 0 and 2)
    for (let tableId = 0; tableId < totalTables; tableId++) {
      const result = tableResults.find(r => r.tableId === tableId);
      if (!result) continue;

      const { winningTeam, team0Players, team1Players } = result;
      const winningTeamPlayers = winningTeam === 0 ? team0Players : team1Players;
      const losingTeamPlayers = winningTeam === 0 ? team1Players : team0Players;

      let stayers: FirestorePlayer[];
      if (tableId === 0) {
        stayers = winningTeamPlayers;
      } else {
        stayers = losingTeamPlayers;
      }

      // Shuffle stayers to avoid repeat teammates
      const shuffledStayers = [...stayers].sort(() => Math.random() - 0.5);
      console.log(`🔄 Shuffled stayers for table ${tableId}:`, shuffledStayers.map(p => p.name));

      // Assign stayers to seats 0 and 1 to break up previous teams
      if (shuffledStayers.length >= 1) {
        newSeating[tableId].push({ ...shuffledStayers[0], seat: 0 });
        console.log(`   ✅ ${shuffledStayers[0].name} stays at table ${tableId}, seat 0`);
      }
      if (shuffledStayers.length >= 2) {
        newSeating[tableId].push({ ...shuffledStayers[1], seat: 1 });
        console.log(`   ✅ ${shuffledStayers[1].name} stays at table ${tableId}, seat 1`);
      }
    }

    // Distribute shuffled movers to seats 2 and 3 at the next table
    let moverIndex = 0;
    
    // Create a mapping of where each mover should go
    const moverDestinations = new Map<string, number>();
    
    // Map movers to their destination tables
    for (let tableId = 0; tableId < totalTables; tableId++) {
      const result = tableResults.find(r => r.tableId === tableId);
      if (!result) continue;

      const { winningTeam, team0Players, team1Players } = result;
      const winningTeamPlayers = winningTeam === 0 ? team0Players : team1Players;
      const losingTeamPlayers = winningTeam === 0 ? team1Players : team0Players;

      let movers: FirestorePlayer[];
      if (tableId === 0) {
        movers = losingTeamPlayers; // Head table losers move
      } else {
        movers = winningTeamPlayers; // Other table winners move
      }

      // Assign destination for each mover
      movers.forEach(mover => {
        const destinationTable = (tableId + 1) % totalTables;
        moverDestinations.set(mover.id, destinationTable);
      });
    }
    
    // Distribute movers to their correct destinations
    for (const mover of shuffledMovers) {
      const destinationTable = moverDestinations.get(mover.id);
      if (destinationTable === undefined) continue;
      
      // Find available seats (2 or 3) at the destination table
      const availableSeats = [2, 3].filter(seat => 
        !newSeating[destinationTable].some(p => p.seat === seat)
      );
      
      if (availableSeats.length > 0) {
        const assignedSeat = availableSeats[0];
        newSeating[destinationTable].push({ ...mover, seat: assignedSeat });
        console.log(`   ➡️ ${mover.name} moves to table ${destinationTable}, seat ${assignedSeat}`);
      }
    }

    // Debug: Show the state of newSeating after assignment
    console.log("🔍 newSeating state after assignment:");
    Object.entries(newSeating).forEach(([tableId, players]) => {
      console.log(`  Table ${tableId}:`, players.map(p => `${p.name} (seat ${p.seat})`));
    });

    // 6. Validate the seating arrangement
    const validationErrors: string[] = [];
    
    // Check that each table has exactly 4 players
    Object.entries(newSeating).forEach(([tableId, players]) => {
      if (players.length !== 4) {
        validationErrors.push(`Table ${tableId} has ${players.length} players instead of 4`);
      }
      
      // Check that seats are properly assigned (0,1,2,3)
      const seats = players.map(p => p.seat).sort();
      if (!seats.every((seat, index) => seat === index)) {
        validationErrors.push(`Table ${tableId} has invalid seat assignments: ${seats.join(',')}`);
      }
      
      // Check that no player is assigned to multiple tables
      const playerIds = players.map(p => p.id);
      const duplicateIds = playerIds.filter((id, index) => playerIds.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        validationErrors.push(`Table ${tableId} has duplicate players: ${duplicateIds.join(',')}`);
      }
    });

    // Check that no player is on the same team as their previous teammate
    const previousTeams = new Map<string, Set<string>>();
    
    // Build previous team relationships
    Object.entries(playersByTable).forEach(([tableId, players]) => {
      const team0Players = players.filter(p => p.seat % 2 === 0);
      const team1Players = players.filter(p => p.seat % 2 === 1);
      
      // Record team 0 relationships
      team0Players.forEach(player => {
        if (!previousTeams.has(player.id)) previousTeams.set(player.id, new Set());
        team0Players.forEach(teammate => {
          if (teammate.id !== player.id) {
            previousTeams.get(player.id)!.add(teammate.id);
          }
        });
      });
      
      // Record team 1 relationships
      team1Players.forEach(player => {
        if (!previousTeams.has(player.id)) previousTeams.set(player.id, new Set());
        team1Players.forEach(teammate => {
          if (teammate.id !== player.id) {
            previousTeams.get(player.id)!.add(teammate.id);
          }
        });
      });
    });
    
    // Only check for repeat teammates if we have previous team relationships
    if (previousTeams.size > 0) {
      // Check new seating for repeat teammates
      Object.entries(newSeating).forEach(([tableId, players]) => {
        const team0Players = players.filter(p => p.seat % 2 === 0);
        const team1Players = players.filter(p => p.seat % 2 === 1);
        
        // Check team 0 for repeat teammates
        team0Players.forEach(player => {
          const previousTeammates = previousTeams.get(player.id);
          if (previousTeammates) {
            team0Players.forEach(newTeammate => {
              if (newTeammate.id !== player.id && previousTeammates.has(newTeammate.id)) {
                validationErrors.push(`${player.name} and ${newTeammate.name} are on the same team again at table ${tableId}`);
              }
            });
          }
        });
        
        // Check team 1 for repeat teammates
        team1Players.forEach(player => {
          const previousTeammates = previousTeams.get(player.id);
          if (previousTeammates) {
            team1Players.forEach(newTeammate => {
              if (newTeammate.id !== player.id && previousTeammates.has(newTeammate.id)) {
                validationErrors.push(`${player.name} and ${newTeammate.name} are on the same team again at table ${tableId}`);
              }
            });
          }
        });
      });
    } else {
      console.log("ℹ️ No previous team relationships found - skipping repeat teammate validation");
    }

    if (validationErrors.length > 0) {
      console.error('❌ Seating validation failed:', validationErrors);
      
      // Try to fix repeat teammate issues by swapping players
      console.log('🔄 Attempting to fix repeat teammate issues...');
      let attempts = 0;
      const maxAttempts = 10;
      
      while (validationErrors.length > 0 && attempts < maxAttempts) {
        attempts++;
        console.log(`🔄 Fix attempt ${attempts}/${maxAttempts}`);
        
        // Clear previous validation errors
        validationErrors.length = 0;
        
        // Reset newSeating completely
        for (let i = 0; i < totalTables; i++) {
          newSeating[i] = [];
        }
        
        // Re-shuffle movers
        const reshuffledMovers = [...allMovers].sort(() => Math.random() - 0.5);
        console.log(`🔄 Re-shuffled movers:`, reshuffledMovers.map(p => p.name));
        
        // Re-assign stayers with shuffling to avoid repeat teammates
        for (let tableId = 0; tableId < totalTables; tableId++) {
          const result = tableResults.find(r => r.tableId === tableId);
          if (!result) continue;

          const { winningTeam, team0Players, team1Players } = result;
          const winningTeamPlayers = winningTeam === 0 ? team0Players : team1Players;
          const losingTeamPlayers = winningTeam === 0 ? team1Players : team0Players;

          let stayers: FirestorePlayer[];
          if (tableId === 0) {
            stayers = winningTeamPlayers;
          } else {
            stayers = losingTeamPlayers;
          }

          // Shuffle stayers for retry
          const reshuffledStayers = [...stayers].sort(() => Math.random() - 0.5);
          console.log(`🔄 Re-shuffled stayers for table ${tableId} (retry):`, reshuffledStayers.map(p => p.name));
          
          if (reshuffledStayers.length >= 1) {
            newSeating[tableId].push({ ...reshuffledStayers[0], seat: 0 });
            console.log(`   ✅ ${reshuffledStayers[0].name} stays at table ${tableId}, seat 0 (retry)`);
          }
          if (reshuffledStayers.length >= 2) {
            newSeating[tableId].push({ ...reshuffledStayers[1], seat: 1 });
            console.log(`   ✅ ${reshuffledStayers[1].name} stays at table ${tableId}, seat 1 (retry)`);
          }
        }
        
        // Re-distribute reshuffled movers
        let moverIndex = 0;
        
        // Create a mapping of where each mover should go (same logic as above)
        const moverDestinations = new Map<string, number>();
        
        // Map movers to their destination tables
        for (let tableId = 0; tableId < totalTables; tableId++) {
          const result = tableResults.find(r => r.tableId === tableId);
          if (!result) continue;

          const { winningTeam, team0Players, team1Players } = result;
          const winningTeamPlayers = winningTeam === 0 ? team0Players : team1Players;
          const losingTeamPlayers = winningTeam === 0 ? team1Players : team0Players;

          let movers: FirestorePlayer[];
          if (tableId === 0) {
            movers = losingTeamPlayers; // Head table losers move
          } else {
            movers = winningTeamPlayers; // Other table winners move
          }

          // Assign destination for each mover
          movers.forEach(mover => {
            const destinationTable = (tableId + 1) % totalTables;
            moverDestinations.set(mover.id, destinationTable);
          });
        }
        
        // Distribute movers to their correct destinations
        for (const mover of reshuffledMovers) {
          const destinationTable = moverDestinations.get(mover.id);
          if (destinationTable === undefined) continue;
          
          // Find available seats (2 or 3) at the destination table
          const availableSeats = [2, 3].filter(seat => 
            !newSeating[destinationTable].some(p => p.seat === seat)
          );
          
          if (availableSeats.length > 0) {
            const assignedSeat = availableSeats[0];
            newSeating[destinationTable].push({ ...mover, seat: assignedSeat });
            console.log(`   ➡️ ${mover.name} moves to table ${destinationTable}, seat ${assignedSeat} (retry)`);
          }
        }

        console.log(`🔍 newSeating state after retry ${attempts}:`);
        Object.entries(newSeating).forEach(([tableId, players]) => {
          console.log(`  Table ${tableId}:`, players.map(p => `${p.name} (seat ${p.seat})`));
        });
        
        // Re-validate
        Object.entries(newSeating).forEach(([tableId, players]) => {
          if (players.length !== 4) {
            validationErrors.push(`Table ${tableId} has ${players.length} players instead of 4`);
          }
          
          const seats = players.map(p => p.seat).sort();
          if (!seats.every((seat, index) => seat === index)) {
            validationErrors.push(`Table ${tableId} has invalid seat assignments: ${seats.join(',')}`);
          }
          
          const playerIds = players.map(p => p.id);
          const duplicateIds = playerIds.filter((id, index) => playerIds.indexOf(id) !== index);
          if (duplicateIds.length > 0) {
            validationErrors.push(`Table ${tableId} has duplicate players: ${duplicateIds.join(',')}`);
          }
        });
        
        // Check for repeat teammates again
        if (previousTeams.size > 0) {
          Object.entries(newSeating).forEach(([tableId, players]) => {
            const team0Players = players.filter(p => p.seat % 2 === 0);
            const team1Players = players.filter(p => p.seat % 2 === 1);
            
            team0Players.forEach(player => {
              const previousTeammates = previousTeams.get(player.id);
              if (previousTeammates) {
                team0Players.forEach(newTeammate => {
                  if (newTeammate.id !== player.id && previousTeammates.has(newTeammate.id)) {
                    validationErrors.push(`${player.name} and ${newTeammate.name} are on the same team again at table ${tableId}`);
                  }
                });
              }
            });
            
            team1Players.forEach(player => {
              const previousTeammates = previousTeams.get(player.id);
              if (previousTeammates) {
                team1Players.forEach(newTeammate => {
                  if (newTeammate.id !== player.id && previousTeammates.has(newTeammate.id)) {
                    validationErrors.push(`${player.name} and ${newTeammate.name} are on the same team again at table ${tableId}`);
                  }
                });
              }
            });
          });
        }
      }
      
      if (validationErrors.length > 0) {
        console.warn('⚠️ Could not fix all validation issues, but proceeding with seating:', validationErrors);
        // Don't throw error, just log warning and continue
      } else {
        console.log('✅ Successfully fixed repeat teammate issues');
      }
    }



    // 7. Validate and log the new seating arrangement
    console.log("🧠 Final seating assignments:");
    Object.entries(newSeating).forEach(([tableId, players]) => {
      console.log(`Table ${tableId}:`, players.map(p => `${p.name} → seat ${p.seat}`));
    });

    // Final validation: Check that movers actually moved
    console.log("🔍 Final validation - checking that movers actually moved:");
    Object.entries(newSeating).forEach(([tableId, players]) => {
      const moversAtTable = players.filter(p => allMovers.some(m => m.id === p.id));
      if (moversAtTable.length > 0) {
        console.log(`  Table ${tableId} movers:`, moversAtTable.map(p => p.name));
      }
    });

    // Verify that Join player moved from head table if they were a loser
    const joinPlayer = players.find(p => p.name === 'Join');
    if (joinPlayer) {
      const joinWasAtHeadTable = playersByTable[0]?.some(p => p.id === joinPlayer.id);
      const joinIsAtHeadTable = newSeating[0]?.some(p => p.id === joinPlayer.id);
      const joinWasLoser = !winners.has(joinPlayer.id);
      
      console.log(`🔍 Join player validation:`);
      console.log(`  Was at head table: ${joinWasAtHeadTable}`);
      console.log(`  Is at head table: ${joinIsAtHeadTable}`);
      console.log(`  Was loser: ${joinWasLoser}`);
      
      if (joinWasAtHeadTable && joinWasLoser && joinIsAtHeadTable) {
        console.warn(`⚠️ Join player should have moved from head table but is still there!`);
      }
    }

    // Add a summary of team assignments
    console.log("👥 Team assignments summary:");
    Object.entries(newSeating).forEach(([tableId, players]) => {
      const team0 = players.filter(p => p.seat % 2 === 0).map(p => p.name);
      const team1 = players.filter(p => p.seat % 2 === 1).map(p => p.name);
      console.log(`Table ${tableId}: Team 0 [${team0.join(', ')}] vs Team 1 [${team1.join(', ')}]`);
    });

    // Show movement summary
    console.log("🔄 Movement summary:");
    Object.entries(newSeating).forEach(([tableId, players]) => {
      const stayers = players.filter(p => allStayers.some(s => s.id === p.id));
      const movers = players.filter(p => allMovers.some(m => m.id === p.id));
      if (stayers.length > 0) {
        console.log(`  Table ${tableId} stayers: ${stayers.map(p => p.name).join(', ')}`);
      }
      if (movers.length > 0) {
        console.log(`  Table ${tableId} movers: ${movers.map(p => p.name).join(', ')}`);
      }
    });

    // 8. Apply seating updates
    for (const [tableIdStr, playersAtTable] of Object.entries(newSeating)) {
      const tableId = Number(tableIdStr);
      const tableObj = tables.find(t => t.id === tableId);
      const nextRound = (tableObj?.round ?? 0) % 6 + 1;

      // Update table document
      try {
        const playerIds = playersAtTable.map(p => p.id);
        await updateDoc(doc(db, 'games', gameCode, 'tables', `${tableId}`), {
          currentTurn: 0,
          dice: [1, 1, 1],
          roundOver: false,
          round: nextRound,
          currentTurnIndex: 0,
          turnStart: Date.now(),
          playerIds: playerIds,
        });
        console.log(`✅ Table ${tableId} reset for round ${nextRound} with players:`, playerIds);
      } catch (err) {
        console.error(`❌ Failed to update table ${tableId}:`, err);
      }

      // Update each player's seat and table
      for (const player of playersAtTable) {
        try {
          await updateDoc(doc(db, 'games', gameCode, 'players', player.id), {
            table: tableId,
            seat: player.seat,
            pointsThisRound: 0,
          });
          console.log(`🔄 Reassigned ${player.name} → table ${tableId}, seat ${player.seat}`);
        } catch (err) {
          console.error(`❌ Failed to reassign ${player.name}:`, err);
        }
      }
    }

    // 9. Reset the nextRoundReady flag and round transition flag
    try {
      await updateDoc(doc(db, 'games', gameCode), {
        nextRoundReady: false,
        roundTransitionInProgress: false
      });
      console.log('🔁 nextRoundReady reset to false');
      console.log('✅ roundTransitionInProgress reset to false');
    } catch (err) {
      console.error('❌ Failed to reset round flags:', err);
    }

    console.log('✅ Round transition complete!');

    // 10. Check for win conditions immediately after round transition
    try {
      const gameDoc = await getDoc(doc(db, 'games', gameCode));
      if (gameDoc.exists()) {
        const gameData = gameDoc.data();
        const targetRounds = gameData.targetRounds !== undefined ? gameData.targetRounds : 6;

        // Get all players with updated round wins
        const playersSnap = await getDocs(collection(db, 'games', gameCode, 'players'));
        const players = playersSnap.docs.map(doc => doc.data());

        // Check if any player has reached the target rounds
        const playersAtTarget = players.filter(player => player.roundsWon >= targetRounds);
        
        if (playersAtTarget.length > 0) {
          // Sort by total points to break ties
          const sortedWinners = playersAtTarget.sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
          const winner = sortedWinners[0];
          
          console.log(`🏆 Game Over! ${winner.name} has won ${winner.roundsWon} rounds (target: ${targetRounds}) with ${winner.totalPoints || 0} total points`);
          
          // Mark game as finished
          await updateDoc(doc(db, 'games', gameCode), {
            gameOver: true,
            winner: {
              id: winner.id,
              name: winner.name,
              roundsWon: winner.roundsWon,
              totalPoints: winner.totalPoints || 0
            },
            finishedAt: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Error checking win condition after round transition:', error);
    }

  } catch (err) {
    console.error('❌ Error during round transition:', err);
  }
}
