import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

// Current user for the whole app: one /auth/check-session request on start instead of one per page.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const res = await axios.get('/auth/check-session');
            const next = res.data?.loggedIn ? res.data.user : null;
            setUser(next);
            return next;
        } catch {
            setUser(null);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    // Throws the axios error so the login form can show the server message (e.g. EMAIL_NOT_VERIFIED)
    const login = useCallback(async (email, password) => {
        const res = await axios.post('/auth/login', { email, password });
        if (!res.data?.success) throw new Error(res.data?.message || 'Login failed');
        // check-session returns the full profile (avatar, socials, role)
        return (await refresh()) || res.data.user;
    }, [refresh]);

    const logout = useCallback(async () => {
        try {
            await axios.post('/auth/logout', {});
        } finally {
            setUser(null);
        }
    }, []);

    const value = useMemo(() => ({
        user,
        loading,
        isLoggedIn: Boolean(user),
        isArtist: user?.role === 'artist',
        login,
        logout,
        refresh,
    }), [user, loading, login, logout, refresh]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
