// @ts-check
'use strict';
/**
 * Indicadores administrativos (ADR-11, RQ04). Función pura y oráculo de pruebas: recibe SOLO los
 * expedientes ya filtrados por el alcance del usuario (buildRequestScopeFilter / canReadRequest).
 * La agregación de Mongo que se implemente debe producir exactamente este resultado (MT-74).
 */
const { STATUSES } = require('./request-state');
const { CHANNELS } = require('./validation');

const DAY_MS = 86400000;
const OPEN = Object.freeze(['REGISTRADA', 'EN_TRAMITE', 'EN_ESPERA_CIUDADANO']);

/** @param {{ history?: Array<{ toStatus?: string|null, at: Date }> }} r */
function closedAt(r) {
  const entries = (r.history || []).filter((h) => h.toStatus === 'CERRADA');
  return entries.length ? entries[entries.length - 1].at : null;
}

/**
 * @param {Array<{ status: string, ownerDependencyId: string, channel?: string, createdAt: Date, history?: any[] }>} requests
 * @param {{ from: Date, to: Date, now: Date, slaDays?: number }} opts  periodo [from, to)
 */
function computeIndicators(requests, opts) {
  const { from, to, now } = opts;
  const slaDays = opts.slaDays ?? 15;
  if (!(from instanceof Date) || !(to instanceof Date) || !(now instanceof Date) || from >= to)
    throw new RangeError('Periodo inválido');
  if (!Number.isInteger(slaDays) || slaDays < 1 || slaDays > 365) throw new RangeError('slaDays inválido');

  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  const byChannel = Object.fromEntries(CHANNELS.map((c) => [c, 0]));
  /** @type {Record<string, number>} */
  const byDependency = {};
  let open = 0;
  let registeredInPeriod = 0;
  let closedInPeriod = 0;
  let resolutionMsSum = 0;
  let overdueOpen = 0;

  for (const r of requests) {
    if (!(r.status in byStatus)) throw new TypeError('Estado desconocido: ' + r.status);
    byStatus[r.status] += 1;
    byDependency[r.ownerDependencyId] = (byDependency[r.ownerDependencyId] || 0) + 1;
    if (r.channel && r.channel in byChannel) byChannel[r.channel] += 1;
    if (r.createdAt >= from && r.createdAt < to) registeredInPeriod += 1;
    if (OPEN.includes(r.status)) {
      open += 1;
      if (now.getTime() - r.createdAt.getTime() > slaDays * DAY_MS) overdueOpen += 1;
    }
    const c = r.status === 'CERRADA' ? closedAt(r) : null;
    if (c && c >= from && c < to) {
      closedInPeriod += 1;
      resolutionMsSum += c.getTime() - r.createdAt.getTime();
    }
  }

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    slaDays,
    total: requests.length,
    open,
    registeredInPeriod,
    closedInPeriod,
    avgResolutionDays: closedInPeriod ? Math.round((resolutionMsSum / closedInPeriod / DAY_MS) * 10) / 10 : null,
    overdueOpen,
    byStatus,
    byDependency,
    byChannel,
  };
}

module.exports = { computeIndicators, closedAt, OPEN };
