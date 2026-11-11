/**
 * MuniERP IA — cliente HTTP real de la API municipal (contrato municipal-v1 draft.3).
 *
 * Reutiliza `apiClient` del ERP (mismo token, renovación y manejo de sesión); solo cambia la URL base
 * por petición a `/api/municipal/v1`. NO se usa todavía en la app: la API no está montada (C-01).
 * Interfaz idéntica a la API simulada (`mockApi.js`) y al adaptador QA del servicio real.
 */
import { Platform } from 'react-native';
import apiClient from '../../services/api';
import { inspectPrivateDocument, savePrivateDocumentWeb, privateDocumentsUnavailable } from './privateDocument';

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
  if (res && res.data && Array.isArray(res.data.fields)) e.fields = res.data.fields.map(String);
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
    /** Sin argumentos: solo ACTIVAS (formularios). F1-15a: la administración pasa `{}` para ver todas. */
    listDependencies: async (params = { status: 'ACTIVA' }) => data(await call('get', m('/dependencies'), { params })),
    /* F1-15a: operaciones de administración ya existentes en draft.3 (x-permission *.manage). */
    createDependency: async (body) => data(await call('post', m('/dependencies'), {}, body)),
    updateDependency: async (code, body) => data(await call('patch', m(`/dependencies/${enc(code)}`), {}, body)),
    /** Página de membresías con paginación del contrato (filtros role, dependency, status, page, limit). */
    listMembershipPage: async (params) => {
      const res = await call('get', m('/memberships'), { params });
      return { items: data(res) || [], pagination: res.data && res.data.pagination };
    },
    createMembership: async (body) => data(await call('post', m('/memberships'), {}, body)),
    updateMembership: async (membershipId, body) => data(await call('patch', m(`/memberships/${enc(membershipId)}`), {}, body)),
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
    /** F1-14: bitácora (solo lectura). Filtros del contrato: folio, entityId, from, to, page, limit. */
    listAuditEvents: async (params) => {
      const res = await call('get', m('/audit-events'), { params });
      return { items: data(res) || [], pagination: res.data && res.data.pagination };
    },
    createRequest: async (body, key) => {
      const res = await call('post', m('/requests'), { headers: { 'Idempotency-Key': key } }, body);
      return { status: res.status, data: data(res) };
    },
    getReceipt: async (folio) => data(await call('get', m(`/requests/${enc(folio)}/receipt`))),
    /**
     * Descarga autorizada: SIEMPRE pasa por el endpoint del servidor, que vuelve a verificar
     * membresía, dependencia, expediente y confidencialidad. Nunca se construye una URL pública.
     */
    /**
     * C-21: documentos privados por el lector municipal separado (privateDocument.js), nunca por el
     * exportador comercial. El servidor autoriza cada lectura; aquí se verifica tipo, firma y tamaño.
     * En Android/iOS no hay lector privado todavía: se informa sin pedir el contenido.
     */
    downloadDocument: async (folio, doc) => {
      if (platform !== 'web') throw privateDocumentsUnavailable();
      const url = m(`/requests/${enc(folio)}/documents/${enc(doc.id)}/content`);
      const res = await call('get', url, { responseType: 'arraybuffer' });
      const bytes = new Uint8Array(res.data);
      const info = inspectPrivateDocument(bytes, { contentType: res.headers && res.headers['content-type'], doc, folio, status: res.status });
      return savePrivateDocumentWeb(bytes, info);
    },
  };
}
