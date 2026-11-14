import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import Commission from './Commission';
import { mockApi, renderApp, GUEST, CUSTOMER } from '../../test/renderApp';

vi.mock('axios');

const REQUESTS = [
    { Commission_ID: 11, Title: 'Our dog as a Renaissance noble', Description: 'Classic oil look', Price: '220.00', imageUrl: '/api/images/commission/11/ref',
        Category: '2D AVATARS', Style: 'Hyperrealism', customer_name: 'Olena K.', Deadline: '2026-12-20' },
    { Commission_ID: 12, Title: 'Album cover', Description: 'Forest at dawn', Price: '350.00', imageUrl: null },
];
const page = (rows, extra = {}) => ({ success: true, commissions: rows, total: rows.length, totalPages: 1, ...extra });
const lastParams = () => axios.get.mock.calls.filter(([url]) => url === '/commissions/public').at(-1)?.[1]?.params;

describe('commission board', () => {
    test('shows open requests with title, description and price', async () => {
        mockApi(GUEST, { '/commissions/public': page(REQUESTS) });
        renderApp(<Commission />, { path: '/commission' });
        expect(screen.getByRole('heading', { level: 1, name: 'Commission board' })).toBeInTheDocument();
        const card = await screen.findByRole('article', { name: REQUESTS[0].Title });
        expect(within(card).getByText('Classic oil look')).toBeInTheDocument();
        expect(within(card).getByText('₴220')).toBeInTheDocument();
        expect(within(card).getByText('2D AVATARS')).toBeInTheDocument();
        expect(within(card).getByText('Hyperrealism')).toBeInTheDocument();
        expect(within(card).getByText('Posted by Olena K.')).toBeInTheDocument();
        expect(within(card).getByText(/^Deadline .*20.*2026/)).toBeInTheDocument();
        expect(within(card).getByRole('img', { name: /reference for/i })).toHaveAttribute('src', REQUESTS[0].imageUrl);
        expect(screen.getAllByRole('button', { name: 'Take' })).toHaveLength(2);
        // a request without a reference picture shows no thumbnail
        expect(within(screen.getByRole('article', { name: 'Album cover' })).queryByRole('img')).not.toBeInTheDocument();
    });

    test('search goes to the server', async () => {
        mockApi(GUEST, { '/commissions/public': page(REQUESTS) });
        renderApp(<Commission />, { path: '/commission' });
        await screen.findByRole('heading', { name: REQUESTS[0].Title });
        fireEvent.change(screen.getByRole('searchbox', { name: /search/i }), { target: { value: 'dog' } });
        await waitFor(() => expect(lastParams()).toMatchObject({ q: 'dog', page: 1 }));
    });

    test('"Take" opens the request details', async () => {
        mockApi(GUEST, {
            '/commissions/public': page(REQUESTS),
            '/commissions/11': { success: true, commission: { Commission_ID: 11, Title: REQUESTS[0].Title, Description: 'Classic oil look', Price: '220.00', images: [] } },
        });
        renderApp(<Commission />, { path: '/commission' });
        await screen.findByRole('heading', { name: REQUESTS[0].Title });
        fireEvent.click(screen.getAllByRole('button', { name: 'Take' })[0]);
        expect(await screen.findByRole('dialog', { name: REQUESTS[0].Title })).toBeInTheDocument();
    });

    test('empty board and server error', async () => {
        mockApi(GUEST, { '/commissions/public': page([]) });
        const { unmount } = renderApp(<Commission />, { path: '/commission' });
        expect(await screen.findByText(/no commissions/i)).toBeInTheDocument();
        unmount();

        mockApi(GUEST, { '/commissions/public': new Error('500') });
        renderApp(<Commission />, { path: '/commission' });
        expect(await screen.findByText(/could not load the commissions/i)).toBeInTheDocument();
    });

    test('only signed-in users can post a request; guests are sent to sign in', async () => {
        mockApi(GUEST, { '/commissions/public': page(REQUESTS) });
        const { unmount } = renderApp(<Commission />, { path: '/commission' });
        await screen.findByRole('heading', { name: REQUESTS[0].Title });
        expect(screen.queryByRole('button', { name: /add commission/i })).not.toBeInTheDocument();
        const panel = screen.getByRole('complementary', { name: 'Post a request' });
        fireEvent.click(within(panel).getByRole('button', { name: 'Sign in to post a request' }));
        expect(screen.getByTestId('location').textContent).toBe('/profile');
        unmount();

        mockApi(CUSTOMER, { '/commissions/public': page(REQUESTS) });
        renderApp(<Commission />, { path: '/commission' });
        const buttons = await screen.findAllByRole('button', { name: /add commission/i });
        expect(buttons).toHaveLength(2); // side panel + floating button on phones
        fireEvent.click(buttons[0]);
        expect(screen.getByRole('dialog', { name: /add commission/i })).toBeInTheDocument();
    });
});

describe('opening the request form from the "+" menu', () => {
    test('signed-in users land with the form open', async () => {
        mockApi(CUSTOMER, { '/commissions/public': page([]) });
        renderApp(<Commission />, { path: { pathname: '/commission', state: { openAddCommission: true } } });
        expect(await screen.findByRole('dialog', { name: /add commission/i })).toBeInTheDocument();
        await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/commission'));
    });

    test('guests do not', async () => {
        mockApi(GUEST, { '/commissions/public': page([]) });
        renderApp(<Commission />, { path: { pathname: '/commission', state: { openAddCommission: true } } });
        await screen.findByText(/no commissions/i);
        await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/commission'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
