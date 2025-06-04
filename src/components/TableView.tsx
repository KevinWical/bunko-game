import React from 'react';
import { useSeatingData } from '../hooks/useSeatingData';
import { useTableData } from '../hooks/useTableData';
import { useFirestoreGame } from '../hooks/useFirestoreGame';
import TableControls from './TableControls';

interface TableViewProps {
  gameCode: string;
  selfId: string;
}

const TableView: React.FC<TableViewProps> = ({ gameCode, selfId }) => {
  const { players } = useFirestoreGame(gameCode, true);
  const { seatingMap, selfSeating } = useSeatingData(gameCode, selfId);
  const currentTable = selfSeating?.table ?? null;
  const currentTableData = useTableData(gameCode, currentTable);

  const groupedTables: Record<number, typeof players> = {};
  Object.entries(seatingMap).forEach(([id, seat]) => {
    if (!groupedTables[seat.table]) groupedTables[seat.table] = [];
    groupedTables[seat.table].push({ ...seat, id });
  });

  return (
    <div className="space-y-6 mt-6">
      {Object.entries(groupedTables).map(([tableIdStr, tablePlayers]) => {
        const tableId = Number(tableIdStr);
        const isCurrentTable = tableId === selfSeating?.table;
        const tableData = isCurrentTable ? currentTableData : null;

        const currentTurnPlayerId = tableData?.playerIds?.[tableData.currentTurn];
        const currentPlayer = currentTurnPlayerId ? seatingMap[currentTurnPlayerId] : null;

        const isFreshRound = tableData?.dice?.every?.(d => d === 1) ?? true;
        const displayDice = isFreshRound ? Array(3).fill(tableData?.round ?? 1) : tableData?.dice ?? [1, 1, 1];
        const playersBySeat = Array(4).fill(null);
        tablePlayers.forEach(p => {
          playersBySeat[p.seat] = p;
        })

        return (
          <div key={tableId} className="border-t border-gray-600 pt-4">
            <h3 className="text-xl text-blue-400 font-semibold">Table {tableId + 1}</h3>

            {isCurrentTable && tableData && (
              <>
                <div className="text-white space-y-1 mb-2">
                  <p>🎲 Dice: {displayDice.join(' | ')}</p>
                  <p>🔁 Round: {tableData.round}</p>
                  <p>🎯 Current Turn: {currentPlayer?.name ?? `Player #${tableData.currentTurn + 1}`}</p>
                </div>
                <TableControls
                  gameCode={gameCode}
                  tableData={tableData}
                  selfId={selfId}
                  seatingMap={seatingMap}
                />
              </>
            )}

            <div className="grid grid-cols-2 gap-2">
              {playersBySeat.map((p, i) =>
                p ? (
                  <div key={p.id} className="border p-2 text-white bg-gray-800 rounded">
                    <p className="font-semibold">{p.name} {p.isBot ? '(Bot)' : ''} {p.id === selfId ? '← You' : ''}</p>
                    <p>Seat: {p.seat + 1}</p>
                    <p>Points: {p.pointsThisRound ?? 0}</p>
                    <p>Total: {p.totalPoints ?? 0}</p>
                    <p>Buncos: {p.buncoCount ?? 0}</p>
                    <p>Wins: {p.roundsWon ?? 0}</p>
                  </div>
                ) : (
                  <div key={i} className="border border-gray-600 p-2 bg-gray-900 text-gray-500 rounded text-center">Empty Seat</div>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TableView;
