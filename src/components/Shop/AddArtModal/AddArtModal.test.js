import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import AddArtModal from './AddArtModal';
import { mockApi, renderApp, ARTIST } from '../../../test/renderApp';
import { SHOP_FILTERS } from '../../../constants/filters';

vi.mock('axios');
vi.mock('socket.io-client', () => ({ io: () => ({ on() {}, off() {}, emit() {}, close() {}, connected: false }) }));

beforeAll(() => {
    URL.createObjectURL = vi.fn((f) => `blob:${f.name}`);
    URL.revokeObjectURL = vi.fn();
});

const png = (name) => new File(['x'], name, { type: 'image/png' });
const dialog = () => screen.getByRole('dialog', { name: /add image/i });
const next = () => fireEvent.click(within(dialog()).getByRole('button', { name: /^Next|Publish artwork/ }));

describe('artwork upload form', () => {
    test('cover first, then details, then file and price; the shop card preview follows', async () => {
        const onClose = vi.fn();
        mockApi(ARTIST);
        renderApp(<AddArtModal onClose={onClose} filterConfig={SHOP_FILTERS} />);
        const preview = screen.getByRole('complementary', { name: 'Live preview · shop card' });
        await within(preview).findByText(/Maya Orlova/);

        next();
        expect(screen.getByText('At least one image is required')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Add images'), { target: { files: [png('cover.png'), png('detail.png')] } });
        expect(screen.getByText('Cover')).toBeInTheDocument();
        expect(preview.querySelector('img')).toHaveAttribute('src', 'blob:cover.png');
        // removing the cover makes the next image the cover
        fireEvent.click(screen.getByRole('button', { name: 'Remove image 1' }));
        expect(preview.querySelector('img')).toHaveAttribute('src', 'blob:detail.png');
        next();

        expect(within(dialog()).getByText('Step 2 of 3 · Details')).toBeInTheDocument();
        next();
        expect(screen.getByText('Name is required')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Night Drive' } });
        fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Loopable background' } });
        fireEvent.click(within(screen.getByRole('group', { name: 'Category' })).getByRole('button', { name: 'GAMES' }));
        expect(within(preview).getByText('Night Drive')).toBeInTheDocument();
        next();

        expect(within(dialog()).getByText('Step 3 of 3 · Price')).toBeInTheDocument();
        fireEvent.click(within(screen.getByRole('group', { name: 'File format' })).getByRole('button', { name: 'WEBP' }));
        fireEvent.change(screen.getByLabelText('Width, px'), { target: { value: '3840' } });
        fireEvent.change(screen.getByLabelText('Height, px'), { target: { value: '2160' } });
        fireEvent.change(screen.getByLabelText('Price, ₴'), { target: { value: '1900' } });
        expect(within(preview).getByText('₴1,900')).toBeInTheDocument();
        next();

        await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/paintings/upload', expect.any(FormData), expect.anything()));
        const sent = [...axios.post.mock.calls.at(-1)[1].entries()];
        expect(Object.fromEntries(sent.filter(([, v]) => !(v instanceof File)))).toEqual({
            title: 'Night Drive', description: 'Loopable background', category: 'GAMES', style: 'Retro Futurism',
            format: 'WEBP', price: '1900', width: '3840', height: '2160', size: '3840x2160',
        });
        expect(sent.filter(([, v]) => v instanceof File).map(([k, v]) => `${k}:${v.name}`)).toEqual(['image:detail.png']);
        expect(await screen.findByText('Your artwork is in the shop!')).toBeInTheDocument();
        expect(onClose).toHaveBeenCalled();
    });

    test('no more than ten images', () => {
        mockApi(ARTIST);
        renderApp(<AddArtModal onClose={() => {}} filterConfig={SHOP_FILTERS} />);
        const files = Array.from({ length: 12 }, (_, i) => png(`p${i}.png`));
        fireEvent.change(screen.getByLabelText('Add images'), { target: { files } });
        expect(screen.getAllByRole('button', { name: /^Remove image/ })).toHaveLength(10);
        expect(screen.getByText('You can upload at most 10 images.')).toBeInTheDocument();
        // the drop zone disappears once the limit is reached
        expect(screen.queryByLabelText('Add images')).not.toBeInTheDocument();
    });
});
