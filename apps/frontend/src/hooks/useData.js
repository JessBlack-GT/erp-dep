/**
 * ============================================
 * ERP-SYSTEM - Hooks Personalizados
 * ============================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '../context/ApiContext';

/**
 * Hook para manejar carga de datos
 */
export function useData(fetchFn, params = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchFn(params);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [fetchFn, JSON.stringify(params)]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook para manejar paginación
 */
export function usePagination(fetchFn, defaultParams = {}) {
  const [page, setPage] = useState(defaultParams.page || 1);
  const [limit] = useState(defaultParams.limit || 20);
  const { data, loading, error, refetch } = useData(fetchFn, { page, limit });

  const nextPage = () => setPage((prev) => prev + 1);
  const prevPage = () => setPage((prev) => Math.max(1, prev - 1));

  return { data, loading, error, page, limit, nextPage, prevPage, refetch };
}

/**
 * Hook para manejar formularios simples
 */
export function useForm(initialValues = {}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const handleChange = (field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const reset = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  };

  return { values, errors, touched, handleChange, handleBlur, reset, setErrors };
}

/**
 * Hook para búsqueda con debounce
 */
export function useSearch(fetchFn, searchFields = []) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const debouncedSearch = debounce(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchFn({ search: searchQuery });
      setResults(data);
    } catch (err) {
      // Error manejado por el componente
    } finally {
      setLoading(false);
    }
  }, 300);

  const handleSearch = (searchQuery) => {
    setQuery(searchQuery);
    debouncedSearch(searchQuery);
  };

  return { query, results, loading, handleSearch, setQuery };
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export default useData;
