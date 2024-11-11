import { useEffect, useMemo, useRef, useState } from "react";
import { Player, useGameContext } from "../context/GameContext";
import { messageResult } from "../lib/utils";
import "./ChatRoom.css";

interface ChatMessage {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

interface BackendChatMessage {
  player_id: string;
  player_name: string;
  message: string;
  timestamp: number;
}

const mapBackendMessage = (msg: BackendChatMessage): ChatMessage => {
  return {
    playerId: msg.player_id,
    playerName: msg.player_name,
    message: msg.message,
    timestamp: msg.timestamp,
  };
};

export const ChatRoom = () => {
  const { currentPlayer, gameState, joinedPlayers } = useGameContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Create a mapping from playerId to playerName (including bazarName)
  const playerMap = useMemo(() => {
    const map = new Map<string, string>();
    joinedPlayers.forEach((player: Player) => {
      const displayName = player.name;
      map.set(player.id, displayName);
      console.log(player.id, displayName);
    });
    return map;
  }, [joinedPlayers]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { Messages } = await messageResult(gameState.gameProcess, [
          {
            name: "Action",
            value: "Get-Chat-Messages",
          },
        ]);

        if (Messages?.[0]?.Data) {
          const rawMessages: BackendChatMessage[] = JSON.parse(
            Messages[0].Data,
          );
          const parsedMessages: ChatMessage[] =
            rawMessages.map(mapBackendMessage);
          console.log("Received messages:", parsedMessages);
          setMessages(parsedMessages);
          scrollToBottom();
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };

    const interval = setInterval(fetchMessages, 2000);
    fetchMessages(); // Initial fetch
    return () => clearInterval(interval);
  }, [gameState.gameProcess]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentPlayer) return;

    try {
      setNewMessage("");
      const { Messages } = await messageResult(gameState.gameProcess, [
        {
          name: "Action",
          value: "Send-Chat-Message",
        },
        {
          name: "Message",
          value: newMessage,
        },
        {
          name: "PlayerName",
          value: currentPlayer.name,
        },
      ]);

      setMessages((prevMessages) => [
        ...prevMessages,
        mapBackendMessage(JSON.parse(Messages[0].Data)),
      ]);
      scrollToBottom();
    } catch (error) {
      setNewMessage(newMessage);
      console.error("Error sending message:", error);
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    try {
      // Determine if the timestamp is in seconds or milliseconds
      const isSeconds = timestamp < 1e12;

      // Convert timestamp to milliseconds if it's in seconds
      const date = isSeconds ? new Date(timestamp * 1000) : new Date(timestamp);

      // Format the date in Indian Standard Time (IST)
      return new Intl.DateTimeFormat("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      }).format(date);
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return ""; // Return an empty string if formatting fails
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="chat-room">
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`message ${
              msg.playerId === currentPlayer?.id ? "own-message" : ""
            }`}
          >
            <div className="message-header">
              <span className="player-name">
                {msg.playerName || playerMap.get(msg.playerId)}
              </span>
              <span className="message-time">
                {formatTimestamp(msg.timestamp)}
              </span>
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
          onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
          placeholder="Type your message..."
          disabled={!currentPlayer?.isAlive}
        />
        <button onClick={handleSendMessage} disabled={!currentPlayer?.isAlive}>
          Send
        </button>
      </div>
    </div>
  );
};
