import { screen, within, fireEvent } from '@testing-library/react';
import DigitalBrushProfile from './DigitalBrushProfile';
import { mockApi, renderApp, CUSTOMER, ARTIST } from '../../../../test/renderApp';

vi.mock('axios');
vi.mock('socket.io-client', () => ({ io: () => ({ on() {}, off() {}, emit() {}, close() {}, disconnect() {}, connected: false }) }));

const order = (id, extra) => ({ Commission_ID: id, Title: `Order ${id}`, Status: 'Open', Review_State: 'none', Customer_ID: 7, Creator_ID: 3, ...extra });
const ORDERS = [
    order(1, { Status: 'Color', Review_State: 'pending' }),          // waits for the customer's review
    order(2, { Status: 'Sketch' }),
    order(3, { Status: 'Open', Creator_ID: null }),                   // the customer's open request
    order(4, { Status: 'Open', Customer_ID: 9 }),                     // a new direct order for the artist
    order(5, { Status: 'Completed' }),
];

const overview = () => screen.getByRole('list', { name: 'Overview' });

describe('my profile', () => {
    test('a customer sees orders, requests and purchases, and no upload or wallet sections', async () => {
        mockApi(CUSTOMER, {
            '/commissions/my': { success: true, commissions: ORDERS },
            '/profile/getboughtpaintings': { success: true, paintings: [{ id: 1 }, { id: 2 }, { id: 3 }] },
        });
        renderApp(<DigitalBrushProfile user={{ ...CUSTOMER, profileImage: '/a.png' }} onLogout={() => {}} />, { path: '/profile' });

        expect(screen.getByRole('heading', { level: 1, name: 'Olena' })).toBeInTheDocument();
        expect(await screen.findByText('1 stage waits for your review')).toBeInTheDocument();
        const cards = within(overview()).getAllByRole('button');
        expect(cards.map((c) => c.textContent)).toEqual([
            'Active orders21 stage waits for your review',
            'Open requests1waiting for an artist',
            'Purchases3artworks you own',
        ]);

        const menu = screen.getByRole('navigation', { name: 'Profile sections' });
        expect(within(menu).getByRole('button', { name: /My commissions/i })).toHaveAttribute('aria-current', 'page');
        expect(within(menu).getByRole('button', { name: /My commissions/i })).toHaveTextContent('1 new');
        expect(within(menu).queryByRole('button', { name: /My images/i })).not.toBeInTheDocument();
        expect(within(menu).queryByRole('button', { name: /Wallet/i })).not.toBeInTheDocument();
        expect(within(menu).getByRole('button', { name: /Purchases/ })).toHaveTextContent('3');
    });

    test('an artist sees the wallet, money on hold and new direct orders', async () => {
        mockApi(ARTIST, {
            '/commissions/my': { success: true, commissions: ORDERS },
            '/wallet': { success: true, balance: { available: 1520, escrow: 2400, withdrawing: 0 }, transactions: [], withdrawals: [] },
        });
        renderApp(<DigitalBrushProfile user={{ ...ARTIST, availability: 'busy' }} onLogout={() => {}} />, { path: '/profile' });

        expect(await screen.findByText('₴1,520')).toBeInTheDocument();
        expect(screen.getByText('Busy, queue is full')).toBeInTheDocument();
        const cards = within(overview()).getAllByRole('button');
        expect(cards[1]).toHaveTextContent('On hold₴2,400');
        expect(cards[2]).toHaveTextContent('Active orders2');
        expect(cards[2]).toHaveTextContent('1 stage waits for the customer');

        const menu = screen.getByRole('navigation', { name: 'Profile sections' });
        expect(within(menu).getByRole('button', { name: /My images/i })).toHaveAttribute('aria-current', 'page');
        expect(within(menu).getByRole('button', { name: /My commissions/i })).toHaveTextContent('1 new');
        fireEvent.click(cards[0]);
        expect(within(menu).getByRole('button', { name: /Wallet/i })).toHaveAttribute('aria-current', 'page');
    });

    test('the "+" next to a section opens its form, and log out calls back', async () => {
        const onLogout = vi.fn();
        mockApi(ARTIST, { '/commissions/my': { success: true, commissions: [] } });
        renderApp(<DigitalBrushProfile user={ARTIST} onLogout={onLogout} />, { path: '/profile' });
        fireEvent.click(screen.getByRole('button', { name: /add image/i }));
        expect(await screen.findByRole('dialog', { name: /add image/i })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /log out/i }));
        expect(onLogout).toHaveBeenCalled();
    });
});
