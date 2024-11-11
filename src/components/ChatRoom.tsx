import { useEffect, useState, useRef } from 'react';
import { useGameContext } from '../context/GameContext';
import { messageResult } from '../lib/utils';
import './ChatRoom.css';

interface ChatMessage {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

export const ChatRoom = () => {
  const { currentPlayer, gameState } = useGameContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { Messages } = await messageResult(gameState.gameProcess, [
          {
            name: 'Action',
            value: 'Get-Chat-Messages',
          },
        ]);
        
        if (Messages?.[0]?.Data) {
          const parsedMessages = JSON.parse(Messages[0].Data);
          setMessages(parsedMessages);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, [gameState.gameProcess]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentPlayer) return;

    try {
      await messageResult(gameState.gameProcess, [
        {
          name: 'Action',
          value: 'Send-Chat-Message',
        },
        {
          name: 'Message',
          value: newMessage,
        },
        {
          name: 'PlayerName',
          value: currentPlayer.name
        }
      ]);

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000); // Convert Unix timestamp to milliseconds
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });
  };

  return (
    <div className="chat-room">
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`message ${msg.playerId === currentPlayer?.id ? 'own-message' : ''}`}
          >
            <div className="message-header">
              <span className="player-name">{msg.playerName}</span>
              <span className="message-time">{formatTimestamp(msg.timestamp)}</span>
            </div>
            <span className="message-content">{msg.message}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type your message..."
          disabled={!currentPlayer?.isAlive}
        />
        <button 
          onClick={handleSendMessage}
          disabled={!currentPlayer?.isAlive}
        >
          Send
        </button>
      </div>
    </div>
  );
}; 