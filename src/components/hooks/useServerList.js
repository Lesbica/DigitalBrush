import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

// One page of a paginated list endpoint ({ [listKey]: [...], total, totalPages }).
// `page` is 0-based for the Pagination component; it goes back to 0 whenever the filters change.
// Empty filter values (undefined, null, '') are not sent.
export default function useServerList(url, { params = {}, limit = 24, listKey, mapItem } = {}) {
    const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    );
    const paramsKey = JSON.stringify(cleanParams);

    const [page, setPage] = useState(0);
    const [prevKey, setPrevKey] = useState(paramsKey);
    if (prevKey !== paramsKey) {
        setPrevKey(paramsKey);
        setPage(0);
    }

    const [state, setState] = useState({ items: [], total: 0, totalPages: 0, loading: true, error: false });
    const mapRef = useRef(mapItem);
    useEffect(() => { mapRef.current = mapItem; });
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        setState(s => ({ ...s, loading: true, error: false }));
        axios.get(url, { params: { ...JSON.parse(paramsKey), page: page + 1, limit }, signal: controller.signal })
            .then(({ data }) => {
                const list = Array.isArray(data?.[listKey]) ? data[listKey] : [];
                setState({
                    items: mapRef.current ? list.map(mapRef.current) : list,
                    total: data.total ?? list.length,
                    totalPages: data.totalPages ?? 1,
                    loading: false,
                    error: false,
                });
            })
            .catch((err) => {
                if (controller.signal.aborted || err?.name === 'CanceledError') return;
                setState({ items: [], total: 0, totalPages: 0, loading: false, error: true });
            });
        return () => controller.abort();
    }, [url, paramsKey, page, limit, listKey, reloadKey]);

    return { ...state, page, setPage, reload: () => setReloadKey(k => k + 1) };
}

// Value that follows `value` after it stops changing for `delay` ms (search inputs)
export function useDebouncedValue(value, delay = 300) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}
