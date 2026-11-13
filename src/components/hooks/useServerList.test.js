import { act, renderHook, waitFor } from '@testing-library/react';
import axios from 'axios';
import useServerList from './useServerList';
import { filtersToParams, toggleFilter } from '../../constants/filters';

vi.mock('axios');

const lastParams = () => axios.get.mock.calls.at(-1)[1].params;

beforeEach(() => {
    axios.get.mockReset();
    axios.get.mockResolvedValue({ data: { paintings: [{ id: 1 }, { id: 2 }], total: 30, totalPages: 3 } });
});

test('loads a page with filters and skips empty values', async () => {
    const { result } = renderHook(() => useServerList('/paintings', {
        params: { category: 'ANIME', q: '', style: undefined }, limit: 10, listKey: 'paintings', mapItem: (p) => p.id,
    }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([1, 2]);
    expect(result.current.totalPages).toBe(3);
    expect(axios.get.mock.calls[0][0]).toBe('/paintings');
    expect(lastParams()).toEqual({ category: 'ANIME', page: 1, limit: 10 });
});

test('changing a filter goes back to the first page', async () => {
    const { result, rerender } = renderHook(({ q }) => useServerList('/paintings', {
        params: { q }, limit: 10, listKey: 'paintings',
    }), { initialProps: { q: 'cat' } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(lastParams().page).toBe(3));
    rerender({ q: 'dog' });
    await waitFor(() => expect(lastParams()).toEqual({ q: 'dog', page: 1, limit: 10 }));
    expect(result.current.page).toBe(0);
});

test('a failed request is reported as an error with an empty list', async () => {
    axios.get.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useServerList('/paintings', { listKey: 'paintings' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.items).toEqual([]);
});

test('advanced filters map to API parameters and toggle off', () => {
    let selected = toggleFilter({}, 'SORT BY', 'CHEAP');
    selected = toggleFilter(selected, 'STYLE', 'Cyberpunk');
    expect(filtersToParams(selected)).toEqual({ sort: 'price_asc', style: 'Cyberpunk', format: undefined });
    selected = toggleFilter(selected, 'STYLE', 'Cyberpunk');
    selected = toggleFilter(selected, 'SORT BY', 'NONE');
    expect(selected).toEqual({});
});
