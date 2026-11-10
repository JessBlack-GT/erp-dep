// @ts-check
'use strict';
/**
 * Regla común a todas las implementaciones del puerto: una consulta de expedientes debe fijar un
 * municipio en la raíz del filtro o en un `$and` de primer nivel. Un `$or` no basta.
 * @param {any} filter
 */
function hasMunicipalityScope(filter) {
  if (!filter || typeof filter !== 'object') return false;
  if (typeof filter.municipalityId === 'string' && filter.municipalityId) return true;
  return Array.isArray(filter.$and) && filter.$and.some(hasMunicipalityScope);
}

module.exports = { hasMunicipalityScope };
