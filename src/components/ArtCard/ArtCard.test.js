import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import ArtCard from './ArtCard';
import Nav from '../Nav/Nav';
import { mockApi, renderApp, GUEST, CUSTOMER } from '../../test/renderApp';

vi.mock('axios');
vi.mock('socket.io-client', () => ({ io: () => ({ on() {}, off() {}, emit() {}, close() {}, connected: false }) }));

const ART = { id: 5, title: 'Violet Hour', artistName: 'Maya Orlova', artistId: 3, price: 240, likes: 12, imageUrl: '/api/images/painting/5' };
const DETAIL = {
    success: true,
    painting: {
        id: 5, title: 'Violet Hour', author_name: 'Maya Orlova', artistId: 3, price: 240, likes: 12,
        likedByCurrentUser: false, category: '2D Avatars', style: 'Digital', format: 'PNG', size: '6000x7500',
        description: 'A late-evening street', mainImage: '/api/images/painting/5?w=1600', gallery: ['/api/images/painting/5/extra/9'],
    },
};

beforeEach(() => localStorage.clear());

describe('art card', () => {
    test('shows title, artist, price in hryvnias and likes', () => {
        mockApi(GUEST);
        renderApp(<ArtCard art={ART} />);
        const card = screen.getByRole('button', { name: /Violet Hour by Maya Orlova/ });
        expect(within(card).getByText('Violet Hour')).toBeInTheDocument();
        expect(within(card).getByText('Maya Orlova')).toBeInTheDocument();
        expect(within(card).getByText('₴240')).toBeInTheDocument();
        expect(within(card).getByText('12')).toBeInTheDocument();
        // decorative picture (alt=""): the card's label already names the work
        expect(card.querySelector('img')).toHaveAttribute('src', ART.imageUrl);
    });

    test('broken pictures fall back to the placeholder', () => {
        mockApi(GUEST);
        renderApp(<ArtCard art={ART} />);
        const img = screen.getByRole('button', { name: /Violet Hour/ }).querySelector('img');
        fireEvent.error(img);
        expect(img.getAttribute('src')).toBe('/images/placeholder.svg');
    });

    test('opens with the keyboard too', async () => {
        mockApi(GUEST, { '/paintings/5': DETAIL });
        renderApp(<ArtCard art={ART} />);
        fireEvent.keyDown(screen.getByRole('button', { name: /Violet Hour/ }), { key: 'Enter' });
        expect(await screen.findByRole('dialog', { name: 'Violet Hour' })).toBeInTheDocument();
    });
});

describe('artwork dialog', () => {
    test('loads the full details and all pictures', async () => {
        mockApi(GUEST, { '/paintings/5': DETAIL });
        renderApp(<ArtCard art={ART} />);
        fireEvent.click(screen.getByRole('button', { name: /Violet Hour/ }));
        const dialog = await screen.findByRole('dialog', { name: 'Violet Hour' });
        expect(axios.get).toHaveBeenCalledWith('/paintings/5');
        await within(dialog).findByText('Digital');
        expect(within(dialog).getByText('PNG')).toBeInTheDocument();
        expect(within(dialog).getByText('A late-evening street')).toBeInTheDocument();
        expect(within(dialog).getAllByRole('button', { name: /open image/i })).toHaveLength(2);
        expect(within(dialog).getByText('₴240')).toBeInTheDocument();
    });

    test('artist name leads to the artist page and closes the dialog', async () => {
        mockApi(GUEST, { '/paintings/5': DETAIL });
        renderApp(<ArtCard art={ART} />);
        fireEvent.click(screen.getByRole('button', { name: /Violet Hour/ }));
        const dialog = await screen.findByRole('dialog', { name: 'Violet Hour' });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Maya Orlova' }));
        expect(screen.getByTestId('location').textContent).toBe('/author/3');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('guests are asked to sign in before buying or liking', async () => {
        mockApi(GUEST, { '/paintings/5': DETAIL });
        renderApp(<ArtCard art={ART} />);
        fireEvent.click(screen.getByRole('button', { name: /Violet Hour/ }));
        const dialog = await screen.findByRole('dialog', { name: 'Violet Hour' });
        fireEvent.click(within(dialog).getByRole('button', { name: /^like/i }));
        expect(await screen.findByText('Sign in to like paintings.')).toBeInTheDocument();
        expect(axios.post).not.toHaveBeenCalled();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Add to basket' }));
        expect(await screen.findByText('Please sign in to add items to your basket.')).toBeInTheDocument();
        expect(JSON.parse(localStorage.getItem('digitalbrush.cart') || '[]')).toEqual([]);
    });

    test('signed-in users like the work and put it in the basket once', async () => {
        mockApi(CUSTOMER, { '/paintings/5': DETAIL, '/profile/check-ownership/5': { owned: false }, '/notifications': { items: [], unread: 0 } });
        axios.post.mockResolvedValue({ data: { success: true, liked: true, likes: 13 } });
        renderApp(<><Nav /><ArtCard art={ART} /></>);
        await screen.findByRole('button', { name: 'Basket is empty' });

        fireEvent.click(screen.getByRole('button', { name: /Violet Hour by/ }));
        const dialog = await screen.findByRole('dialog', { name: 'Violet Hour' });

        fireEvent.click(within(dialog).getByRole('button', { name: /^like/i }));
        await waitFor(() => expect(within(dialog).getByRole('button', { name: /remove like \(13\)/i })).toHaveAttribute('aria-pressed', 'true'));
        expect(axios.post).toHaveBeenCalledWith('/paintings/5/like');

        fireEvent.click(within(dialog).getByRole('button', { name: 'Add to basket' }));
        expect(await screen.findByText('Added to the basket!')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Basket, 1 item' })).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Add to basket' }));
        expect(JSON.parse(localStorage.getItem('digitalbrush.cart'))).toHaveLength(1);
    });

    test('owners download instead of buying', async () => {
        mockApi(CUSTOMER, { '/paintings/5': DETAIL, '/profile/check-ownership/5': { owned: true } });
        renderApp(<ArtCard art={ART} />);
        fireEvent.click(screen.getByRole('button', { name: /Violet Hour/ }));
        const dialog = await screen.findByRole('dialog', { name: 'Violet Hour' });
        expect(await within(dialog).findByRole('button', { name: 'Download' })).toBeInTheDocument();
        expect(within(dialog).queryByRole('button', { name: 'Add to basket' })).not.toBeInTheDocument();
    });

    test('Escape closes the dialog', async () => {
        mockApi(GUEST, { '/paintings/5': DETAIL });
        renderApp(<ArtCard art={ART} />);
        fireEvent.click(screen.getByRole('button', { name: /Violet Hour/ }));
        const dialog = await screen.findByRole('dialog', { name: 'Violet Hour' });
        fireEvent.keyDown(dialog, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });
});
