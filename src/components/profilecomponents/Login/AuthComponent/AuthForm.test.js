import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import AuthLayout from './AuthForm';
import { API_BASE } from '../../../../config';

vi.mock('axios');

const renderAt = (path) => render(
    <MemoryRouter initialEntries={[path]}>
        <AuthLayout onCreateAccount={() => {}}><p>form</p></AuthLayout>
    </MemoryRouter>
);

test('the Google button leads to the server and keeps the return path', async () => {
    axios.get.mockResolvedValue({ data: { google: true } });
    renderAt('/profile?next=%2Fcheckout');
    const link = await screen.findByRole('link', { name: /continue with google/i });
    expect(link).toHaveAttribute('href', `${API_BASE}/auth/google?next=%2Fcheckout`);
    expect(axios.get).toHaveBeenCalledWith('/auth/providers');
});

test('no Google button when the server has no Google keys', async () => {
    axios.get.mockResolvedValue({ data: { google: false } });
    renderAt('/profile');
    await screen.findByText('form');
    await Promise.resolve();
    expect(screen.queryByRole('link', { name: /google/i })).not.toBeInTheDocument();
});
