import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestWSPage() {
  const [messages, setMessages] = useState<Array<{ text: string; type: 'sent' | 'received' }>>([]);
  const [message, setMessage] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState<Array<{ id: string; name: string; score: number }>>([]);

  useEffect(() => {
    // Get the WebSocket URL based on the current host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
      setMessages(prev => [...prev, { text: 'Connected to WebSocket server', type: 'received' }]);
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Message from server:', data);
        
        switch (data.type) {
          case 'init':
            setPlayers(data.players || []);
            setMessages(prev => [...prev, { 
              text: `Connected as ${data.playerId}. ${data.players?.length || 0} players online.`, 
              type: 'received' 
            }]);
            break;
            
          case 'player-joined':
            setPlayers(prev => [...prev, data.player]);
            setMessages(prev => [...prev, { 
              text: `${data.player.name} joined the game`, 
              type: 'received' 
            }]);
            break;
            
          case 'player-left':
            setPlayers(prev => prev.filter(p => p.id !== data.playerId));
            setMessages(prev => [...prev, { 
              text: `Player ${data.playerId} left the game`, 
              type: 'received' 
            }]);
            break;
            
          case 'chat-message':
            setMessages(prev => [...prev, { 
              text: `${data.playerName}: ${data.message}`, 
              type: 'received' 
            }]);
            break;
            
          case 'score-update':
            setPlayers(prev => 
              prev.map(p => 
                p.id === data.playerId 
                  ? { ...p, score: data.score } 
                 : p
              )
            );
            break;
            
          default:
            setMessages(prev => [...prev, { 
              text: `Unknown message type: ${data.type}`, 
              type: 'received' 
            }]);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };
    
    socket.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      setMessages(prev => [...prev, { text: 'Disconnected from WebSocket server', type: 'received' }]);
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setMessages(prev => [...prev, { text: `Error: ${error}`, type: 'received' }]);
    };
    
    setWs(socket);
    
    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, []);
  
  const sendMessage = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setMessages(prev => [...prev, { text: 'Not connected to WebSocket server', type: 'received' }]);
      return;
    }
    
    if (message.trim()) {
      ws.send(JSON.stringify({
        type: 'chat-message',
        message: message.trim(),
      }));
      
      setMessages(prev => [...prev, { text: `You: ${message}`, type: 'sent' }]);
      setMessage('');
    }
  };
  
  const updateName = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN || !playerName.trim()) return;
    
    ws.send(JSON.stringify({
      type: 'update-name',
      name: playerName.trim(),
    }));
    
    setMessages(prev => [...prev, { 
      text: `Changed name to: ${playerName.trim()}`, 
      type: 'received' 
    }]);
  };
  
  const updateScore = (increment: number) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    ws.send(JSON.stringify({
      type: 'update-score',
      score: increment,
    }));
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>WebSocket Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Input
                placeholder="Your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="flex-1"
              />
              <Button onClick={updateName} disabled={!connected}>
                Set Name
              </Button>
            </div>
            
            <div className="flex items-center gap-2 mb-4">
              <Input
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                className="flex-1"
                disabled={!connected}
              />
              <Button onClick={sendMessage} disabled={!connected}>
                Send
              </Button>
            </div>
            
            <div className="flex gap-2 mb-4">
              <Button 
                variant="outline" 
                onClick={() => updateScore(10)}
                disabled={!connected}
              >
                +10 Points
              </Button>
              <Button 
                variant="outline" 
                onClick={() => updateScore(-5)}
                disabled={!connected}
              >
                -5 Points
              </Button>
            </div>
            
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Players Online: {players.length}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {players.map(player => (
                  <div key={player.id} className="border rounded p-2 flex justify-between items-center">
                    <span className="font-medium">{player.name}</span>
                    <span className="text-sm text-muted-foreground">
                      Score: {player.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="border rounded-md p-4 h-64 overflow-y-auto bg-muted/20">
            {messages.length === 0 ? (
              <p className="text-muted-foreground text-center my-8">
                {connected ? 'Send a message to begin...' : 'Connecting to server...'}
              </p>
            ) : (
              messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`mb-2 ${msg.type === 'sent' ? 'text-right' : ''}`}
                >
                  <div 
                    className={`inline-block px-3 py-2 rounded-lg ${
                      msg.type === 'sent' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
