import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import Shop from './Shop';
import { mockApi, renderApp, paintingRows, GUEST, CUSTOMER, ARTIST } from '../../test/renderApp';

vi.mock('axios');

const page = (rows, extra = {}) => ({ success: true, paintings: rows, total: rows.length, totalPages: 1, ...extra });
// the last /paintings request the shop sent
const lastParams = () => axios.get.mock.calls.filter(([url]) => url === '/paintings').at(-1)?.[1]?.params;

describe('shop', () => {
    test('lists works from the server as cards', async () => {
        mockApi(GUEST, { '/paintings': page(paintingRows(4)) });
        renderApp(<Shop />, { path: '/shop' });
        expect(screen.getByRole('heading', { level: 1, name: 'The shop' })).toBeInTheDocument();
        expect(await screen.findAllByRole('button', { name: /^Work \d+ by / })).toHaveLength(4);
        expect(lastParams()).toMatchObject({ page: 1, limit: 48, sort: 'newest' });
        expect(screen.getByText('4 artworks')).toBeInTheDocument();
    });

    test('style, price and sort go to the server; clear resets the filters', async () => {
        mockApi(GUEST, { '/paintings': page(paintingRows(2)) });
        renderApp(<Shop />, { path: '/shop' });
        await screen.findAllByRole('button', { name: /^Work/ });
        fireEvent.change(screen.getByRole('combobox', { name: 'Style' }), { target: { value: 'Cyberpunk' } });
        await waitFor(() => expect(lastParams()).toMatchObject({ style: 'Cyberpunk' }));
        fireEvent.change(screen.getByRole('slider', { name: 'Max price' }), { target: { value: '1500' } });
        await waitFor(() => expect(lastParams()).toMatchObject({ maxPrice: 1500 }));
        expect(screen.getByText('up to ₴1,500')).toBeInTheDocument();
        fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), { target: { value: 'CHEAP' } });
        await waitFor(() => expect(lastParams()).toMatchObject({ sort: 'price_asc' }));
        fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
        await waitFor(() => expect(lastParams()).not.toHaveProperty('style'));
        expect(lastParams()).not.toHaveProperty('maxPrice');
    });

    test('a style link from the home page arrives as a filter', async () => {
        mockApi(GUEST, { '/paintings': page(paintingRows(1)) });
        renderApp(<Shop />, { path: '/shop?style=Synthwave' });
        await screen.findAllByRole('button', { name: /^Work/ });
        expect(lastParams()).toMatchObject({ style: 'Synthwave' });
        expect(screen.getByRole('combobox', { name: 'Style' })).toHaveValue('Synthwave');
    });

    test('on phones the filters open in a sheet', async () => {
        mockApi(GUEST, { '/paintings': page(paintingRows(3)) });
        renderApp(<Shop />, { path: '/shop' });
        await screen.findAllByRole('button', { name: /^Work/ });
        fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
        const sheet = screen.getByRole('dialog', { name: 'Filters' });
        fireEvent.click(within(sheet).getByRole('button', { name: 'GAMES' }));
        await waitFor(() => expect(lastParams()).toMatchObject({ category: 'GAMES' }));
        fireEvent.click(within(sheet).getByRole('button', { name: /^Show 3 artworks/ }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Filters 1/ })).toBeInTheDocument();
    });

    test('search is sent to the server after typing stops', async () => {
        mockApi(GUEST, { '/paintings': page(paintingRows(2)) });
        renderApp(<Shop />, { path: '/shop' });
        await screen.findAllByRole('button', { name: /^Work/ });
        fireEvent.change(screen.getByRole('searchbox', { name: /search/i }), { target: { value: '  violet  ' } });
        await waitFor(() => expect(lastParams()).toMatchObject({ q: 'violet', page: 1 }));
    });

    test('category chips filter and toggle off on a second click', async () => {
        mockApi(GUEST, { '/paintings': page(paintingRows(2)) });
        renderApp(<Shop />, { path: '/shop' });
        await screen.findAllByRole('button', { name: /^Work/ });
        const chip = screen.getByRole('button', { name: '2D AVATARS' });
        fireEvent.click(chip);
        await waitFor(() => expect(lastParams()).toMatchObject({ category: '2D AVATARS' }));
        fireEvent.click(chip);
        await waitFor(() => expect(lastParams()?.category).toBeUndefined());
    });

    test('empty result and server error have their own messages', async () => {
        mockApi(GUEST, { '/paintings': page([]) });
        const { unmount } = renderApp(<Shop />, { path: '/shop' });
        expect(await screen.findByText(/no paintings/i)).toBeInTheDocument();
        unmount();

        mockApi(GUEST, { '/paintings': new Error('500') });
        renderApp(<Shop />, { path: '/shop' });
        expect(await screen.findByText(/could not load/i)).toBeInTheDocument();
    });

    test('pagination asks the server for the next page', async () => {
        mockApi(GUEST, { '/paintings': page(paintingRows(2), { total: 100, totalPages: 3 }) });
        renderApp(<Shop />, { path: '/shop' });
        await screen.findAllByRole('button', { name: /^Work/ });
        fireEvent.click(screen.getByRole('button', { name: /page 2/i }));
        await waitFor(() => expect(lastParams()).toMatchObject({ page: 2 }));
    });

    test('only artists get the upload button', async () => {
        mockApi(CUSTOMER, { '/paintings': page(paintingRows(1)) });
        const { unmount } = renderApp(<Shop />, { path: '/shop' });
        await screen.findAllByRole('button', { name: /^Work/ });
        expect(screen.queryByRole('button', { name: /add image/i })).not.toBeInTheDocument();
        unmount();

        mockApi(ARTIST, { '/paintings': page(paintingRows(1)) });
        renderApp(<Shop />, { path: '/shop' });
        fireEvent.click(await screen.findByRole('button', { name: /add image/i }));
        expect(screen.getByRole('dialog', { name: /add image/i })).toBeInTheDocument();
    });
});

describe('opening the upload form from the "+" menu', () => {
    test('artists land on the shop with the form open', async () => {
        mockApi(ARTIST, { '/paintings': page([]) });
        renderApp(<Shop />, { path: { pathname: '/shop', state: { openAddArt: true } } });
        expect(await screen.findByRole('dialog', { name: /add image/i })).toBeInTheDocument();
        // the flag is cleared, so going back does not reopen it
        await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/shop'));
    });

    test('customers do not get the form', async () => {
        mockApi(CUSTOMER, { '/paintings': page([]) });
        renderApp(<Shop />, { path: { pathname: '/shop', state: { openAddArt: true } } });
        await screen.findByText(/no paintings/i);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/shop'));
    });
});
