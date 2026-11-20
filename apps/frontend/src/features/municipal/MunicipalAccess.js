import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { createMunicipalApi } from './municipalApi';

const empty = { loading: false, error: false, memberships: [] };
const Context = createContext({ ...empty, reload: () => {} });

export function MunicipalAccessProvider({ children }) {
  const { isAuthenticated, token, user } = useAuth();
  const session = isAuthenticated ? token : null;
  const synthetic = user?.syntheticMunicipalDemo === true;
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const [snapshot, setSnapshot] = useState(null);
  useEffect(() => {
    if (!session) {
      setSnapshot(null);
      return;
    }
    const controller = new AbortController();
    const api = createMunicipalApi();
    const update = (result) => {
      if (!controller.signal.aborted) setSnapshot({ session, attempt, ...empty, ...result });
    };
    api.myMemberships({ signal: controller.signal })
      .then((memberships) => update({ memberships: Array.isArray(memberships) ? memberships : [] }))
      .catch((error) => update({ error: error.status !== 404 }));
    return () => controller.abort();
  }, [session, attempt]);

  const result = !session ? empty : snapshot?.session === session && snapshot?.attempt === attempt
    ? snapshot : { ...empty, loading: true };

  return <Context.Provider value={{ ...result, reload, synthetic }}>{children}</Context.Provider>;
}

export function useMunicipalAccess() {
  return useContext(Context);
}
