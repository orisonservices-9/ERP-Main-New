import { useCallback, useEffect, useState } from 'react';
import pApi, { errText } from './platformApi';

// Loads `path` from the platform API and lets the page reload it after a change.
export default function useFetch(path, params) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const key = JSON.stringify(params || {});
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const { data } = await pApi.get(path, { params: JSON.parse(key) });
      setState({ data, loading: false, error: '' });
    } catch (err) {
      setState({ data: null, loading: false, error: errText(err) });
    }
  }, [path, key]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
