/**
 * MuniERP IA — cliente HTTP real de la API municipal (contrato municipal-v1 draft.3).
 *
 * Reutiliza `apiClient` del ERP (mismo token, renovación y manejo de sesión); solo cambia la URL base
 * por petición a `/api/municipal/v1`. NO se usa todavía en la app: la API no está montada (C-01).
 * Interfaz idéntica a la API simulada (`mockApi.js`) y al adaptador QA del servicio real.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../../services/api';
import { downloadFile } from '../../utils/downloadFile';

/** /api/v1 → /api/municipal/v1 sobre la misma URL base configurada para el ERP. */
export function municipalBaseUrl(erpBase = apiClient.defaults.baseURL || '') {
  return String(erpBase).replace(/\/api\/v1\/?$/, '') + '/api/municipal/v1';
}

/** Normaliza errores de axios a { status, code, message } sin exponer detalles internos. */
export function toApiError(error) {
  const res = error && error.response;
  const e = new Error((res && res.data && res.data.error) || 'Error de comunicación');
  e.status = res ? res.status : 0;
  e.code = res && res.data ? res.data.code : 'NETWORK_ERROR';
  return e;
}

export function createMunicipalApi({ client = apiClient, mun = 'SJH', platform = Platform.OS } = {}) {
  const baseURL = municipalBaseUrl(client.defaults && client.defaults.baseURL);
  const m = (path) => `/municipalities/${mun}${path}`;
  const call = async (method, url, config = {}, body) => {
    try {
      const res = body === undefined ? await client[method](url, { baseURL, ...config }) : await client[method](url, body, { baseURL, ...config });
      return res;
    } catch (error) {
      throw toApiError(error);
    }
  };
  const data = (res) => res.data && res.data.data;
  const enc = encodeURIComponent;

  return {
    isMock: false,
    myMemberships: async () => data(await call('get', '/me/memberships')),
    listDependencies: async () => data(await call('get', m('/dependencies'), { params: { status: 'ACTIVA' } })),
    searchCitizens: async (q) => data(await call('get', m('/citizens'), { params: q ? { q } : {} })),
    listMemberships: async (params) => data(await call('get', m('/memberships'), { params })),
    listRequests: async (params) => {
      const res = await call('get', m('/requests'), { params });
      return { items: res.data.data, pagination: res.data.pagination };
    },
    getRequest: async (folio) => {
      const res = await call('get', m(`/requests/${enc(folio)}`));
      return { data: data(res), etag: res.headers && res.headers.etag };
    },
    getRequestHistory: async (folio) => data(await call('get', m(`/requests/${enc(folio)}/history`))),
    listDocuments: async (folio) => data(await call('get', m(`/requests/${enc(folio)}/documents`))),
    transitionRequest: async (folio, body) => data(await call('post', m(`/requests/${enc(folio)}/transitions`), {}, body)),
    getIndicators: async (params) => data(await call('get', m('/indicators'), { params })),
    createRequest: async (body, key) => {
      const res = await call('post', m('/requests'), { headers: { 'Idempotency-Key': key } }, body);
      return { status: res.status, data: data(res) };
    },
    getReceipt: async (folio) => data(await call('get', m(`/requests/${enc(folio)}/receipt`))),
    /**
     * Descarga autorizada: SIEMPRE pasa por el endpoint del servidor, que vuelve a verificar
     * membresía, dependencia, expediente y confidencialidad. Nunca se construye una URL pública.
     */
    downloadDocument: async (folio, doc) => {
      const url = m(`/requests/${enc(folio)}/documents/${enc(doc.id)}/content`);
      if (platform === 'android') {
        const token = await AsyncStorage.getItem('accessToken');
        await downloadFile({ url: client.getUri({ baseURL, url }), headers: token ? { Authorization: `Bearer ${token}` } : {} }, doc.filename);
        return { saved: true };
      }
      const res = await call('get', url, { responseType: 'blob' });
      downloadFile(res, doc.filename);
      return { saved: true };
    },
  };
}
