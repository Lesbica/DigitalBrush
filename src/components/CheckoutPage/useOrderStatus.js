import { useEffect, useState } from 'react';
import axios from 'axios';

const POLL_MS = 3000;
const MAX_POLLS = 20; // ~1 minute; the notification bell reports the result after that

// Status of the buyer's own order from GET /payments/orders/:id, polled while it is pending.
// state: 'loading' | 'approved' | 'pending' | 'failed' | 'unknown'
export default function useOrderStatus(orderId) {
    const [result, setResult] = useState({ state: orderId ? 'loading' : 'unknown', order: null });

    useEffect(() => {
        if (!orderId) return undefined;
        let cancelled = false;
        let timer = null;
        let polls = 0;

        const check = async () => {
            try {
                const { data } = await axios.get(`/payments/orders/${encodeURIComponent(orderId)}`);
                if (cancelled) return;
                if (data.status === 'pending' && polls++ < MAX_POLLS) {
                    setResult({ state: 'pending', order: data });
                    timer = setTimeout(check, POLL_MS);
                    return;
                }
                const state = data.status === 'approved' ? 'approved' : data.status === 'pending' ? 'pending' : 'failed';
                setResult({ state, order: data });
            } catch {
                if (!cancelled) setResult({ state: 'unknown', order: null });
            }
        };

        check();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [orderId]);

    return result;
}
