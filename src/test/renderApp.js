// Test helpers: render a page inside the same providers as the real app, with a fake API.
// Not a test file itself (vitest only runs *.test.js).
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import axios from 'axios';
import { ToastProvider } from '../context/ToastContext';
import { AuthProvider } from '../context/AuthContext';
import { SocketProvider } from '../context/SocketContext';
import { CartProvider } from '../components/Cart/CartContext';
import { ModalProvider } from '../context/ModalContext';

export const GUEST = null;
export const CUSTOMER = { id: 7, name: 'Olena', role: 'customer' };
export const ARTIST = { id: 3, name: 'Maya Orlova', role: 'artist' };

// axios.get answers by URL; anything not listed resolves to an empty success.
// `routes` values may be objects or functions of (url, config).
export function mockApi(user, routes = {}) {
    axios.get.mockImplementation(async (url, config) => {
        if (url === '/auth/check-session') {
            return { data: user ? { loggedIn: true, user } : { loggedIn: false } };
        }
        const key = Object.keys(routes).find((k) => (k.endsWith('*') ? url.startsWith(k.slice(0, -1)) : url === k));
        if (key) {
            const value = routes[key];
            const data = typeof value === 'function' ? value(url, config) : value;
            if (data instanceof Error) throw data;
            return { data };
        }
        return { data: { success: true } };
    });
    axios.post?.mockResolvedValue?.({ data: { success: true } });
    axios.put?.mockResolvedValue?.({ data: { success: true } });
    axios.patch?.mockResolvedValue?.({ data: { success: true } });
}

// Prints where the router is, so tests can check navigation and its state
export function LocationProbe() {
    const location = useLocation();
    return (
        <p data-testid="location">
            {location.pathname}
            {location.state ? ` ${JSON.stringify(location.state)}` : ''}
        </p>
    );
}

export function renderApp(ui, { path = '/', routes } = {}) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <ToastProvider>
                <AuthProvider>
                    <SocketProvider>
                        <CartProvider>
                            <ModalProvider>
                                {ui}
                                {routes ? (
                                    <Routes>
                                        {Object.entries(routes).map(([p, el]) => <Route key={p} path={p} element={el} />)}
                                    </Routes>
                                ) : <LocationProbe />}
                            </ModalProvider>
                        </CartProvider>
                    </SocketProvider>
                </AuthProvider>
            </ToastProvider>
        </MemoryRouter>
    );
}

// API painting rows as GET /paintings returns them
export function paintingRows(n, extra = {}) {
    return Array.from({ length: n }, (_, i) => ({
        id: i + 1,
        Painting_ID: i + 1,
        title: `Work ${i + 1}`,
        Title: `Work ${i + 1}`,
        author_name: i % 2 ? 'Leo Hartmann' : 'Maya Orlova',
        Creator_ID: i % 2 ? 4 : 3,
        price: 100 + i,
        Price: 100 + i,
        likes: i,
        style: i % 2 ? 'Watercolour' : 'Digital',
        image: `/api/images/painting/${i + 1}`,
        ...extra,
    }));
}
