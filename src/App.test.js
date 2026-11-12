import { render, screen } from '@testing-library/react';
import axios from 'axios';
import App from './App';

vi.mock('axios');

test('renders the navigation of the app', async () => {
    axios.get.mockResolvedValue({ data: { loggedIn: false, paintings: [] } });
    render(<App />);
    expect((await screen.findAllByText(/shop/i)).length).toBeGreaterThan(0);
});
