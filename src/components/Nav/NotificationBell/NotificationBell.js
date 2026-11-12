import React, {useCallback, useEffect, useRef, useState} from "react";
import {useNavigate} from "react-router-dom";
import axios from "axios";
import {io} from "socket.io-client";
import styles from "./NotificationBell.module.css";
import {SOCKET_BASE} from "../../../config";

// Bell with unread counter. New notifications arrive live over socket.io (the server puts every
// logged-in socket into its user room); the counter is also refreshed every minute as a fallback.
export default function NotificationBell() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);
    const wrapperRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const res = await axios.get('/notifications', {params: {limit: 20}});
            setItems(res.data.notifications || []);
            setUnread(res.data.unread || 0);
        } catch {
            // not logged in any more or offline — keep the old state
        }
    }, []);

    useEffect(() => {
        load();
        const timer = setInterval(load, 60000);
        const socket = io(SOCKET_BASE, {withCredentials: true, transports: ['websocket', 'polling']});
        socket.on('notification', (n) => {
            setItems(prev => [n, ...prev.filter(x => x.id !== n.id)].slice(0, 20));
            setUnread(u => u + 1);
        });
        return () => {
            clearInterval(timer);
            socket.close();
        };
    }, [load]);

    useEffect(() => {
        if (!open) return undefined;
        const onClick = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [open]);

    const openItem = async (n) => {
        if (!n.read) {
            setItems(prev => prev.map(x => (x.id === n.id ? {...x, read: true} : x)));
            setUnread(u => Math.max(u - 1, 0));
            axios.patch(`/notifications/${n.id}/read`).catch(() => {});
        }
        setOpen(false);
        if (n.link) navigate(n.link);
    };

    const readAll = async () => {
        setItems(prev => prev.map(x => ({...x, read: true})));
        setUnread(0);
        axios.post('/notifications/read-all').catch(() => {});
    };

    return (
        <div className={styles.wrapper} ref={wrapperRef}>
            <button
                type="button"
                className={styles.bell}
                onClick={() => { setOpen(o => !o); if (!open) load(); }}
                aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
                aria-expanded={open}
            >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
            </button>

            {open && (
                <div className={styles.panel} role="dialog" aria-label="Notifications">
                    <div className={styles.header}>
                        <span>Notifications</span>
                        {unread > 0 && <button type="button" className={styles.readAll} onClick={readAll}>Mark all as read</button>}
                    </div>
                    {items.length === 0 ? (
                        <div className={styles.empty}>No notifications yet</div>
                    ) : (
                        <ul className={styles.list}>
                            {items.map(n => (
                                <li key={n.id}>
                                    <button type="button" className={`${styles.item} ${n.read ? '' : styles.unread}`} onClick={() => openItem(n)}>
                                        <span className={styles.title}>{n.title}</span>
                                        {n.body && <span className={styles.body}>{n.body}</span>}
                                        <span className={styles.time}>{new Date(n.createdAt).toLocaleString()}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
