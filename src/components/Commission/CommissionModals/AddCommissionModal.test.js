import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import AddCommissionModal from './AddCommissionModal';
import { mockApi, renderApp, CUSTOMER } from '../../../test/renderApp';

vi.mock('axios');
vi.mock('socket.io-client', () => ({ io: () => ({ on() {}, off() {}, emit() {}, close() {}, connected: false }) }));

beforeAll(() => {
    URL.createObjectURL = vi.fn((f) => `blob:${f.name}`);
    URL.revokeObjectURL = vi.fn();
});

const png = (name = 'ref.png') => new File(['x'], name, { type: 'image/png' });
const dialog = () => screen.getByRole('dialog', { name: /add commission/i });
const next = () => fireEvent.click(within(dialog()).getByRole('button', { name: /^Next|Publish request|Send to the artist/ }));
const posted = () => Object.fromEntries([...axios.post.mock.calls.at(-1)[1].entries()].map(([k, v]) => [k, v instanceof File ? v.name : v]));

function fillIdea() {
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Our dog as a noble' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Oil look, dark background' } });
    fireEvent.change(screen.getByLabelText('References'), { target: { files: [png()] } });
}

describe('commission request form', () => {
    test('goes through three steps, checks each one and publishes the request', async () => {
        const onClose = vi.fn();
        mockApi(CUSTOMER);
        renderApp(<AddCommissionModal onClose={onClose} />);

        expect(within(dialog()).getByText('Step 1 of 3 · Idea')).toBeInTheDocument();
        expect(within(dialog()).getByRole('heading', { name: 'What would you like to order?' })).toBeInTheDocument();

        // empty step: errors, no move
        next();
        expect(screen.getByText('Name is required')).toBeInTheDocument();
        expect(screen.getByText('Description is required')).toBeInTheDocument();
        expect(screen.getByText('At least one image is required')).toBeInTheDocument();
        expect(within(dialog()).getByText('Step 1 of 3 · Idea')).toBeInTheDocument();

        fillIdea();
        // the live preview follows the form
        const preview = screen.getByRole('complementary', { name: 'Live preview · commission board' });
        expect(within(preview).getByRole('heading', { name: 'Our dog as a noble' })).toBeInTheDocument();
        next();

        expect(within(dialog()).getByText('Step 2 of 3 · Details')).toBeInTheDocument();
        fireEvent.click(within(screen.getByRole('group', { name: 'Category' })).getByRole('button', { name: 'GAMES' }));
        fireEvent.click(within(screen.getByRole('group', { name: 'Style' })).getByRole('button', { name: 'Cyberpunk' }));
        expect(within(preview).getByText('Cyberpunk')).toBeInTheDocument();
        next();
        expect(screen.getByText('Size is required')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Width, px'), { target: { value: '30a00' } });
        fireEvent.change(screen.getByLabelText('Height, px'), { target: { value: '4000' } });
        expect(screen.getByLabelText('Width, px')).toHaveValue('3000');
        next();

        expect(within(dialog()).getByText('Step 3 of 3 · Budget')).toBeInTheDocument();
        next();
        expect(screen.getByText('Price is required')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Your budget'), { target: { value: '2500' } });
        expect(within(preview).getByText('₴2,500')).toBeInTheDocument();
        next();

        await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/commissions/create', expect.any(FormData), expect.anything()));
        expect(posted()).toEqual({
            title: 'Our dog as a noble', description: 'Oil look, dark background', category: 'GAMES', style: 'Cyberpunk',
            size: '3000x4000', format: 'PNG', price: '2500', referenceImage: 'ref.png',
        });
        expect(await screen.findByText('Public commission created!')).toBeInTheDocument();
        expect(onClose).toHaveBeenCalled();
    });

    test('"Back" keeps what was typed; a direct order goes to the artist', async () => {
        mockApi(CUSTOMER);
        renderApp(<AddCommissionModal onClose={() => {}} targetCreatorId={15} />);
        expect(screen.getByRole('complementary', { name: 'Live preview · what the artist will see' })).toBeInTheDocument();
        fillIdea();
        next();
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Back' }));
        expect(screen.getByLabelText('Name')).toHaveValue('Our dog as a noble');
        next();
        fireEvent.change(screen.getByLabelText('Width, px'), { target: { value: '1000' } });
        fireEvent.change(screen.getByLabelText('Height, px'), { target: { value: '1000' } });
        next();
        fireEvent.change(screen.getByLabelText('Your budget'), { target: { value: '900' } });
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Send to the artist' }));
        await waitFor(() => expect(posted()).toMatchObject({ creatorId: '15', price: '900' }));
        expect(await screen.findByText('Commission request sent to the artist!')).toBeInTheDocument();
    });

    test('a server error is shown and the dialog stays open', async () => {
        const onClose = vi.fn();
        mockApi(CUSTOMER);
        axios.post.mockRejectedValueOnce({ response: { data: { message: 'You cannot order from yourself' } } });
        renderApp(<AddCommissionModal onClose={onClose} />);
        fillIdea();
        next();
        fireEvent.change(screen.getByLabelText('Width, px'), { target: { value: '10' } });
        fireEvent.change(screen.getByLabelText('Height, px'), { target: { value: '10' } });
        next();
        fireEvent.change(screen.getByLabelText('Your budget'), { target: { value: '100' } });
        next();
        expect(await screen.findByText('You cannot order from yourself')).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
        expect(dialog()).toBeInTheDocument();
    });

    test('Escape and the close button close it', () => {
        const onClose = vi.fn();
        mockApi(CUSTOMER);
        renderApp(<AddCommissionModal onClose={onClose} />);
        fireEvent.keyDown(dialog(), { key: 'Escape' });
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }));
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
