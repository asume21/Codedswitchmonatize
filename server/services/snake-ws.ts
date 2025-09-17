import { WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { WebSocket } from 'ws';

interface SnakePlayer {
  id: string;
  ws: WebSocket;
  name: string;
  score: number;
  color: string;
}

export function setupSnakeWS(server: Server) {
  const wss = new WebSocketServer({ server });
  const players = new Map<string, SnakePlayer>();
  const colors = [
    '#FF5252', // Red
    '#4CAF50', // Green
    '#2196F3', // Blue
    '#FFC107', // Amber
    '#9C27B0', // Purple
    '#00BCD4', // Cyan
  ];

  wss.on('connection', (ws: WebSocket) => {
    const playerId = Math.random().toString(36).substr(2, 9);
    const color = colors[Math.floor(Math.random() * colors.length)];
    const player: SnakePlayer = {
      id: playerId,
      ws,
      name: `Player-${playerId.substr(0, 4)}`,
      score: 0,
      color,
    };

    players.set(playerId, player);
    console.log(`Player connected: ${playerId}`);

    // Send initial game state
    ws.send(JSON.stringify({
      type: 'init',
      playerId,
      color,
      players: Array.from(players.values()).map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        color: p.color,
      })),
    }));

    // Broadcast new player to others
    broadcast({
      type: 'player-joined',
      player: {
        id: player.id,
        name: player.name,
        score: player.score,
        color: player.color,
      },
    }, playerId);

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        
        switch (data.type) {
          case 'update-score':
            if (players.has(playerId)) {
              const player = players.get(playerId)!;
              player.score = data.score;
              broadcast({
                type: 'score-update',
                playerId,
                score: data.score,
              });
            }
            break;
          
          case 'chat-message':
            broadcast({
              type: 'chat-message',
              playerId,
              playerName: players.get(playerId)?.name || 'Unknown',
              message: data.message,
              timestamp: Date.now(),
            });
            break;
          
          case 'update-name':
            if (players.has(playerId) && typeof data.name === 'string' && data.name.trim()) {
              const player = players.get(playerId)!;
              player.name = data.name.trim().substring(0, 20);
              broadcast({
                type: 'player-updated',
                playerId,
                name: player.name,
              });
            }
            break;
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    ws.on('close', () => {
      players.delete(playerId);
      console.log(`Player disconnected: ${playerId}`);
      broadcast({
        type: 'player-left',
        playerId,
      });
    });
  });

  function broadcast(message: any, excludePlayerId?: string) {
    const json = JSON.stringify(message);
    for (const [id, player] of players.entries()) {
      if (id !== excludePlayerId && player.ws.readyState === 1) {
        player.ws.send(json);
      }
    }
  }

  return wss;
}
