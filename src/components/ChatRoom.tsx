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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
          setMessages(JSON.parse(Messages[0].Data));
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
      ]);

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="chat-room">
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`message ${msg.playerId === currentPlayer?.id ? 'own-message' : ''}`}
          >
            <span className="player-name">{msg.playerName}:</span>
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