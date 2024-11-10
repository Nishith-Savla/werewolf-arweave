import { useGameEvents } from '../hooks/useGameEvents';
import './GameNotifications.css';

export const GameNotifications = () => {
	useGameEvents();
	return null;
};
