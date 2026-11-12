import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_BASE } from '../config';
import { useAuth } from './AuthContext';

// One socket.io connection per logged-in user, shared by the notification bell, commission list
// and chat. The server identifies the user by the session cookie, so the socket is recreated
// whenever the user changes and closed on logout.
const SocketContext = createContext(null);

export function SocketProvider({ children }) {
    const { user } = useAuth();
    const userId = user?.id;
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        if (!userId) {
            setSocket(null);
            return undefined;
        }
        const s = io(SOCKET_BASE, { withCredentials: true, transports: ['websocket', 'polling'] });
        setSocket(s);
        return () => {
            s.close();
        };
    }, [userId]);

    return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);

// Joins a commission chat room for as long as the component is mounted; re-joins after reconnects.
export function useCommissionRoom(socket, commissionId) {
    useEffect(() => {
        if (!socket || !commissionId) return undefined;
        const room = `commission_${commissionId}`;
        const join = () => socket.emit('join', room);
        if (socket.connected) join();
        socket.on('connect', join);
        return () => {
            socket.off('connect', join);
            socket.emit('leave', room);
        };
    }, [socket, commissionId]);
}
