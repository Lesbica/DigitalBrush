import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Nav from './Nav';
import { mockApi, renderApp, GUEST, CUSTOMER, ARTIST } from '../../test/renderApp';

vi.mock('axios');
vi.mock('socket.io-client', () => ({ io: () => ({ on() {}, off() {}, emit() {}, close() {}, connected: false }) }));

beforeEach(() => {
    localStorage.clear();
});

const location = () => screen.getByTestId('location').textContent;

describe('top navigation', () => {
    test('shows the main sections and marks the current one', async () => {
        mockApi(GUEST);
        renderApp(<Nav />, { path: '/shop' });
        const main = screen.getByRole('navigation', { name: 'Menu' });
        for (const name of ['Home', 'Shop', 'Artists', 'Commissions']) {
            expect(within(main).getByRole('button', { name })).toBeInTheDocument();
        }
        expect(within(main).getByRole('button', { name: 'Shop' })).toHaveAttribute('aria-current', 'page');
        expect(within(main).getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current');
    });

    test('links go to their pages, the logo goes home', async () => {
        mockApi(GUEST);
        const user = userEvent; // user-event 13: no setup()
        renderApp(<Nav />, { path: '/shop' });
        const main = screen.getByRole('navigation', { name: 'Menu' });
        await user.click(within(main).getByRole('button', { name: 'Artists' }));
        expect(location()).toBe('/artists');
        await user.click(screen.getByRole('button', { name: 'DigitalBrush, home page' }));
        expect(location()).toBe('/');
    });

    test('guests see "Sign in" and no cart or notifications', async () => {
        mockApi(GUEST);
        renderApp(<Nav />);
        expect(await screen.findAllByRole('button', { name: 'Sign in' })).toHaveLength(2); // header + tab bar
        expect(screen.queryByRole('button', { name: /basket/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /notifications/i })).not.toBeInTheDocument();
    });

    test('signed-in users see the cart with its item count', async () => {
        localStorage.setItem('digitalbrush.cart', JSON.stringify([
            { id: 1, title: 'A', price: 10, quantity: 1 },
            { id: 2, title: 'B', price: 20, quantity: 1 },
        ]));
        mockApi(CUSTOMER, { '/notifications': { items: [], unread: 0 } });
        renderApp(<Nav />);
        const cart = await screen.findByRole('button', { name: 'Basket, 2 items' });
        expect(cart).toHaveTextContent('2');
        expect(screen.getAllByRole('button', { name: 'Profile' }).length).toBeGreaterThan(0);
    });
});

describe('phone tab bar and the "+" menu', () => {
    test('tab bar has Home, Shop, Commissions, Profile and a create button', async () => {
        mockApi(GUEST);
        renderApp(<Nav />, { path: '/commission' });
        const bar = screen.getByRole('navigation', { name: 'Main navigation' });
        expect(within(bar).getByRole('button', { name: 'Home' })).toBeInTheDocument();
        expect(within(bar).getByRole('button', { name: 'Shop' })).toBeInTheDocument();
        expect(within(bar).getByRole('button', { name: 'Commissions' })).toHaveAttribute('aria-current', 'page');
        expect(within(bar).getByRole('button', { name: 'What do you want to do?' })).toBeInTheDocument();
    });

    test('guests only get the request option and are sent to sign in', async () => {
        mockApi(GUEST);
        const user = userEvent; // user-event 13: no setup()
        renderApp(<Nav />);
        await user.click(screen.getByRole('button', { name: 'What do you want to do?' }));
        const sheet = screen.getByRole('dialog', { name: 'What do you want to do?' });
        expect(within(sheet).queryByRole('button', { name: /sell an artwork/i })).not.toBeInTheDocument();
        await user.click(within(sheet).getByRole('button', { name: /post a commission request/i }));
        expect(location()).toBe('/profile');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('customers open the request form on the commission page', async () => {
        mockApi(CUSTOMER, { '/notifications': { items: [], unread: 0 } });
        const user = userEvent; // user-event 13: no setup()
        renderApp(<Nav />);
        await screen.findByRole('button', { name: /basket/i }); // session loaded
        await user.click(screen.getByRole('button', { name: 'What do you want to do?' }));
        expect(screen.queryByRole('button', { name: /sell an artwork/i })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /post a commission request/i }));
        expect(location()).toBe('/commission {"openAddCommission":true}');
    });

    test('artists can also start selling from the menu', async () => {
        mockApi(ARTIST, { '/notifications': { items: [], unread: 0 } });
        const user = userEvent; // user-event 13: no setup()
        renderApp(<Nav />);
        await screen.findByRole('button', { name: /basket/i });
        await user.click(screen.getByRole('button', { name: 'What do you want to do?' }));
        await user.click(screen.getByRole('button', { name: /sell an artwork/i }));
        expect(location()).toBe('/shop {"openAddArt":true}');
    });

    test('Escape and Cancel close the menu', async () => {
        mockApi(GUEST);
        const user = userEvent; // user-event 13: no setup()
        renderApp(<Nav />);
        const plus = screen.getByRole('button', { name: 'What do you want to do?' });
        await user.click(plus);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(plus).toHaveFocus());

        await user.click(plus);
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
