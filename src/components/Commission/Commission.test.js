import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import Commission from './Commission';
import { mockApi, renderApp, GUEST, CUSTOMER } from '../../test/renderApp';

vi.mock('axios');

const REQUESTS = [
    { Commission_ID: 11, Title: 'Our dog as a Renaissance noble', Description: 'Classic oil look', Price: '220.00', imageUrl: '/api/images/commission/11/ref' },
    { Commission_ID: 12, Title: 'Album cover', Description: 'Forest at dawn', Price: '350.00', imageUrl: null },
];
const page = (rows, extra = {}) => ({ success: true, commissions: rows, total: rows.length, totalPages: 1, ...extra });
const lastParams = () => axios.get.mock.calls.filter(([url]) => url === '/commissions/public').at(-1)?.[1]?.params;

describe('commission board', () => {
    test('shows open requests with title, description and price', async () => {
        mockApi(GUEST, { '/commissions/public': page(REQUESTS) });
        renderApp(<Commission />, { path: '/commission' });
        expect(screen.getByRole('heading', { level: 1, name: 'Commissions' })).toBeInTheDocument();
        const title = await screen.findByRole('heading', { name: REQUESTS[0].Title });
        const card = title.closest('div').parentElement.parentElement;
        expect(within(card).getByText('Classic oil look')).toBeInTheDocument();
        expect(within(card).getByText('₴220')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Take' })).toHaveLength(2);
        // a request without a reference picture gets the placeholder
        expect(screen.getByAltText('Album cover')).toHaveAttribute('src', '/images/placeholder.svg');
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

    test('only signed-in users can post a request', async () => {
        mockApi(GUEST, { '/commissions/public': page(REQUESTS) });
        const { unmount } = renderApp(<Commission />, { path: '/commission' });
        await screen.findByRole('heading', { name: REQUESTS[0].Title });
        expect(screen.queryByRole('button', { name: /add commission/i })).not.toBeInTheDocument();
        unmount();

        mockApi(CUSTOMER, { '/commissions/public': page(REQUESTS) });
        renderApp(<Commission />, { path: '/commission' });
        fireEvent.click(await screen.findByRole('button', { name: /add commission/i }));
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
