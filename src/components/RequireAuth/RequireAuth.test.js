import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import axios from 'axios';
import { AuthProvider } from '../../context/AuthContext';
import RequireAuth from './RequireAuth';
import NotFound from '../NotFound/NotFound';

vi.mock('axios');

function ShowLocation() {
    const location = useLocation();
    return <p>at {location.pathname + location.search}</p>;
}

const renderAt = (path) => render(
    <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
            <Routes>
                <Route path='/checkout' element={<RequireAuth><p>checkout page</p></RequireAuth>} />
                <Route path='/profile' element={<ShowLocation />} />
                <Route path='*' element={<NotFound />} />
            </Routes>
        </AuthProvider>
    </MemoryRouter>
);

test('guests are sent to sign in and brought back afterwards', async () => {
    axios.get.mockResolvedValue({ data: { loggedIn: false } });
    renderAt('/checkout');
    expect(await screen.findByText('at /profile?next=%2Fcheckout')).toBeInTheDocument();
    expect(screen.queryByText('checkout page')).not.toBeInTheDocument();
});

test('logged-in users see the protected page', async () => {
    axios.get.mockResolvedValue({ data: { loggedIn: true, user: { id: 7, name: 'Test', role: 'customer' } } });
    renderAt('/checkout');
    expect(await screen.findByText('checkout page')).toBeInTheDocument();
});

test('unknown paths show the 404 page', async () => {
    axios.get.mockResolvedValue({ data: { loggedIn: false } });
    renderAt('/no-such-page');
    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument();
});
