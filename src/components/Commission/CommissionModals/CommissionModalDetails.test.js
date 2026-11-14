import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import CommissionModalDetails from './CommissionModalDetails';
import { mockApi, renderApp, GUEST, CUSTOMER, ARTIST } from '../../../test/renderApp';

vi.mock('axios');
vi.mock('socket.io-client', () => ({ io: () => ({ on() {}, off() {}, emit() {}, close() {}, connected: false }) }));

const REQUEST = { id: 11, title: 'Bruno as a noble', description: 'Oil look', price: '2200.00', imageUrl: '/api/images/commission/11/ref' };
const details = (extra = {}) => ({
    '/commissions/11': { success: true, commission: { title: 'Bruno as a noble', description: 'Oil look', category: '2D AVATARS', style: 'Hyperrealism',
        format: 'PNG', size: '4000x5000', price: '2200.00', status: 'Open', Customer_ID: 7, Creator_ID: null, deadline: '2026-12-20',
        images: ['/api/images/commission/11/ref', '/api/images/commission/11/2'], ...extra } },
});
const open = (user, props = {}, extra) => {
    mockApi(user, details(extra));
    renderApp(<CommissionModalDetails commission={REQUEST} onClose={props.onClose || (() => {})} {...props} />);
    return screen.getByRole('dialog', { name: 'Bruno as a noble' });
};

describe('commission request details', () => {
    test('shows tags, status, details, budget and the extra references', async () => {
        const dialog = open(GUEST);
        expect(await within(dialog).findByText('Hyperrealism')).toBeInTheDocument();
        expect(within(dialog).getByText('2D AVATARS')).toBeInTheDocument();
        expect(within(dialog).getByText('4000x5000')).toBeInTheDocument();
        expect(within(dialog).getByText('₴2,200')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'Open image 2 in full size' })).toBeInTheDocument();
    });

    test('artists can accept; customers and the author of the request cannot', async () => {
        let dialog = open(ARTIST);
        await within(dialog).findByText('Hyperrealism');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Accept' }));
        await waitFor(() => expect(axios.patch).toHaveBeenCalledWith('/commissions/11/accept', {}));
        document.body.innerHTML = '';

        dialog = open(CUSTOMER); // id 7 = Customer_ID
        await within(dialog).findByText('Hyperrealism');
        expect(within(dialog).queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    });

    test('declining asks for confirmation in the footer first', async () => {
        const onStatusChange = vi.fn();
        mockApi(ARTIST, details({ Creator_ID: 3 }));
        axios.patch.mockReset();
        axios.patch.mockResolvedValue({ data: { success: true, status: 'Declined' } });
        renderApp(<CommissionModalDetails commission={REQUEST} onClose={() => {}} respondAsArtist onStatusChange={onStatusChange} />);
        const dialog = screen.getByRole('dialog', { name: 'Bruno as a noble' });
        await within(dialog).findByText('Hyperrealism');

        fireEvent.click(within(dialog).getByRole('button', { name: 'Decline' }));
        expect(within(dialog).getByRole('alert')).toHaveTextContent('Decline this commission?');
        fireEvent.click(within(dialog).getByRole('button', { name: 'No' }));
        expect(axios.patch).not.toHaveBeenCalled();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Decline' }));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Yes' }));
        await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith('Declined'));
        expect(axios.patch).toHaveBeenCalledWith('/commissions/11/decline');
    });
});
