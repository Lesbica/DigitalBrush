import { act, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from '../../context/ToastContext';

function Buttons({ onRetry }) {
    const toast = useToast();
    return (
        <>
            <button onClick={() => toast.success('Saved')}>ok</button>
            <button onClick={() => toast.error('Failed', { action: { label: 'Retry', onClick: onRetry } })}>fail</button>
        </>
    );
}

afterEach(() => vi.useRealTimers());

test('a toast disappears by itself; errors are announced as alerts', () => {
    vi.useFakeTimers();
    render(<ToastProvider><Buttons onRetry={() => {}} /></ToastProvider>);
    fireEvent.click(screen.getByText('ok'));
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
});

test('an action button runs once and closes the toast', () => {
    const onRetry = vi.fn();
    render(<ToastProvider><Buttons onRetry={onRetry} /></ToastProvider>);
    fireEvent.click(screen.getByText('fail'));
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('the same message is not stacked on a double click', () => {
    render(<ToastProvider><Buttons onRetry={() => {}} /></ToastProvider>);
    fireEvent.click(screen.getByText('ok'));
    fireEvent.click(screen.getByText('ok'));
    expect(screen.getAllByText('Saved')).toHaveLength(1);
});
