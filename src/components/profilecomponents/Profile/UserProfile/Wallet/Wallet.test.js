import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import Wallet from './Wallet';

vi.mock('axios');

const walletData = {
    success: true,
    balance: { available: 500, escrow: 0, withdrawing: 0 },
    feePercent: 10,
    minWithdrawal: 100,
    transactions: [],
    withdrawals: [],
};

function mockServer(payout) {
    axios.get.mockImplementation((url) => Promise.resolve({ data: url === '/wallet' ? walletData : { success: true, ...payout } }));
}

beforeEach(() => vi.resetAllMocks());

test('with a linked card the payout goes to the card, without an IBAN', async () => {
    mockServer({ enabled: true, card: { mask: '41****8217', type: 'Visa' } });
    axios.post.mockResolvedValue({ data: { withdrawal: { id: 1, status: 'paid' } } });
    render(<Wallet />);
    expect(await screen.findByText('Card 41****8217')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /to the card/i })).toBeChecked();
    expect(screen.queryByLabelText('IBAN')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/amount in uah/i), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: /request withdrawal/i }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/wallet/withdrawals', { amount: 200, method: 'card' }));
    expect(await screen.findByText(/on its way to your card/i)).toBeInTheDocument();
});

test('payouts on but no card: offers to link one and keeps the IBAN form', async () => {
    mockServer({ enabled: true, card: null });
    render(<Wallet />);
    expect(await screen.findByRole('button', { name: /link a card/i })).toBeInTheDocument();
    expect(screen.getByLabelText('IBAN')).toBeInTheDocument();
});

test('payouts off: only the IBAN form', async () => {
    mockServer({ enabled: false, card: null });
    render(<Wallet />);
    expect(await screen.findByLabelText('IBAN')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /link a card/i })).not.toBeInTheDocument();
});
