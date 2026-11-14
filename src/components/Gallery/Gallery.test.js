import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import Gallery from './Gallery';
import { mockApi, renderApp, paintingRows, GUEST, CUSTOMER } from '../../test/renderApp';

vi.mock('axios');

const location = () => screen.getByTestId('location').textContent;
const freshCards = () => within(screen.getByRole('region', { name: 'Fresh this week' }))
    .getAllByRole('button', { name: /^Work \d+ by /i });

describe('home page', () => {
    test('hero with the two main actions', async () => {
        mockApi(GUEST, { '/paintings': { paintings: [] } });
        renderApp(<Gallery />);
        expect(screen.getByRole('heading', { level: 1, name: /original art, straight from the artist/i })).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('button', { name: /browse the shop/i })[0]);
        expect(location()).toBe('/shop');
        fireEvent.click(screen.getByRole('button', { name: /order a commission/i }));
        expect(location()).toBe('/commission');
    });

    test('shows the latest works as cards with price and artist', async () => {
        mockApi(GUEST, { '/paintings': { paintings: paintingRows(3) } });
        renderApp(<Gallery />);
        const fresh = await screen.findByRole('region', { name: 'Fresh this week' });
        const list = within(fresh).getAllByRole('button', { name: /^Work \d+ by /i });
        expect(list).toHaveLength(3);
        expect(list[0]).toHaveAccessibleName(/Work 1 by Maya Orlova, ₴100/);
        expect(within(list[0]).getByText('Work 1')).toBeInTheDocument();
    });

    test('featured work opens the artwork dialog', async () => {
        mockApi(GUEST, {
            '/paintings': { paintings: paintingRows(3) },
            '/paintings/1': { success: true, painting: { id: 1, title: 'Work 1', author_name: 'Maya Orlova', price: 100, likes: 0, gallery: [] } },
        });
        renderApp(<Gallery />);
        const hero = await screen.findByText('New in the shop');
        fireEvent.click(hero.closest('button'));
        expect(await screen.findByRole('dialog', { name: 'Work 1' })).toBeInTheDocument();
    });

    test('pick of the week (phones) opens the same work', async () => {
        mockApi(GUEST, {
            '/paintings': { paintings: paintingRows(3) },
            '/paintings/1': { success: true, painting: { id: 1, title: 'Work 1', author_name: 'Maya Orlova', price: 100, likes: 0, gallery: [] } },
        });
        renderApp(<Gallery />);
        const pick = await screen.findByRole('region', { name: 'Work 1' });
        expect(within(pick).getByText('Pick of the week')).toBeInTheDocument();
        fireEvent.click(within(pick).getByRole('button', { name: 'View artwork' }));
        expect(await screen.findByRole('dialog', { name: 'Work 1' })).toBeInTheDocument();
    });

    test('style links under the hero open the shop with that style', async () => {
        mockApi(GUEST, { '/paintings': { paintings: [] } });
        renderApp(<Gallery />);
        fireEvent.click(screen.getByRole('button', { name: 'Cyberpunk' }));
        expect(location()).toBe('/shop');
        expect(screen.getByTestId('location')).toHaveAttribute('data-search', '?style=Cyberpunk');
    });

    test('category chips filter the fresh works and show the count', async () => {
        mockApi(GUEST, { '/paintings': { paintings: paintingRows(6) } });
        renderApp(<Gallery />);
        const fresh = await screen.findByRole('region', { name: 'Fresh this week' });
        expect(within(fresh).getByText('6 pieces')).toBeInTheDocument();
        const games = within(fresh).getByRole('button', { name: 'GAMES' });
        fireEvent.click(games);
        expect(games).toHaveAttribute('aria-pressed', 'true');
        expect(freshCards().map((c) => c.getAttribute('aria-label').split(' by ')[0])).toEqual(['Work 1', 'Work 4']);
        expect(within(fresh).getByText('2 pieces')).toBeInTheDocument();
        fireEvent.click(within(fresh).getByRole('button', { name: 'All' }));
        expect(freshCards()).toHaveLength(6);
    });

    test('the commission tracker sends guests to the board and members to the request form', async () => {
        mockApi(GUEST, { '/paintings': { paintings: [] } });
        const { unmount } = renderApp(<Gallery />);
        const track = screen.getByRole('region', { name: /watch your commission/i });
        expect(within(track).getAllByRole('listitem')).toHaveLength(4);
        fireEvent.click(within(track).getByRole('button', { name: 'Start a request' }));
        expect(location()).toBe('/commission');
        unmount();

        mockApi(CUSTOMER, { '/paintings': { paintings: [] } });
        renderApp(<Gallery />);
        const track2 = screen.getByRole('region', { name: /watch your commission/i });
        await waitFor(() => {
            fireEvent.click(within(track2).getByRole('button', { name: 'Start a request' }));
            expect(screen.getByTestId('location').textContent).toBe('/commission {"openAddCommission":true}');
        });
    });

    test('artists row lists each artist once and links to the profile', async () => {
        mockApi(GUEST, { '/paintings': { paintings: paintingRows(6) } });
        renderApp(<Gallery />);
        const artists = await screen.findByRole('region', { name: 'Artists' });
        const buttons = within(within(artists).getByRole('list')).getAllByRole('button');
        expect(buttons.map((b) => b.textContent)).toEqual(['MMaya Orlova', 'LLeo Hartmann']);
        fireEvent.click(buttons[1]);
        expect(location()).toBe('/author/4');
        fireEvent.click(within(artists).getByRole('button', { name: /all artists/i }));
        expect(location()).toBe('/artists');
    });

    test('search filters by title, artist or style and says when nothing matches', async () => {
        mockApi(GUEST, { '/paintings': { paintings: paintingRows(6) } });
        renderApp(<Gallery />);
        await screen.findByRole('region', { name: 'Fresh this week' });
        const search = screen.getByRole('searchbox', { name: /search/i });

        fireEvent.change(search, { target: { value: 'leo' } });
        expect(freshCards().every((c) => /Leo Hartmann/.test(c.getAttribute('aria-label')))).toBe(true);

        fireEvent.change(search, { target: { value: 'watercolour' } });
        expect(freshCards().every((c) => /Leo Hartmann/.test(c.getAttribute('aria-label')))).toBe(true);

        fireEvent.change(search, { target: { value: 'no such thing' } });
        expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });

    test('shows twelve works and a link to the shop when there are more', async () => {
        mockApi(GUEST, { '/paintings': { paintings: paintingRows(15) } });
        renderApp(<Gallery />);
        const fresh = await screen.findByRole('region', { name: 'Fresh this week' });
        expect(within(fresh).getAllByRole('button', { name: /^Work \d+ by /i })).toHaveLength(12);
        fireEvent.click(screen.getByRole('button', { name: 'See all in the shop' }));
        expect(location()).toBe('/shop');
    });

    test('a failed request does not break the page', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockApi(GUEST, { '/paintings': new Error('Network down') });
        renderApp(<Gallery />);
        expect(await screen.findByText(/no results found/i)).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
});
