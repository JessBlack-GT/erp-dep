/**
 * MuniERP IA — aplicación de DEMOSTRACIÓN (F1-15a). Se abre desde Windows con ABRIR-DEMO.cmd.
 *
 * MODO DEMOSTRACIÓN, claramente identificado en pantalla:
 *  - API SIMULADA: el servicio municipal REAL del backend (autorización, folios, historial, bitácora,
 *    indicadores) se ejecuta en el navegador con almacén EN MEMORIA. Sin HTTP, sin JWT, sin MongoDB.
 *  - Datos 100 % SINTÉTICOS. Ninguna persona real, ninguna credencial.
 *  - «Restablecer demostración» vuelve a sembrar el mismo conjunto de datos (reproducible).
 *  - Cambiar de perfil conserva los datos: lo que hace el administrador lo ve después el titular.
 *
 * No es la integración HTTP real: esa se hace montando `MunicipalApp` en el ERP con
 * `createMunicipalApi` cuando Codex exponga /api/municipal/v1 en su anfitrión local (C-01).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { View, Pressable, StyleSheet } from 'react-native';
import { MunicipalApp } from '../src/features/municipal';
import { Text, Button } from '../src/components/common';
import { savePrivateDocumentWeb } from '../src/features/municipal/privateDocument';
import { createServiceBackedWorld } from './service-backed-api';

export const DEMO_LABEL = 'MODO DEMOSTRACIÓN · API simulada en el navegador (servicio municipal real en memoria) · datos sintéticos · sin HTTP, sin MongoDB';

const PERSONAS = [
  { key: 'u_vent', label: 'Ventanilla', hint: 'Registra solicitudes y entrega el folio' },
  { key: 'u_tit_obp', label: 'Titular de Obras Públicas', hint: 'Atiende, turna y concluye expedientes' },
  { key: 'u_sup', label: 'Supervisor municipal', hint: 'Panel, indicadores y todas las solicitudes' },
  { key: 'u_admin_mun', label: 'Administrador municipal', hint: 'Dependencias y membresías' },
  { key: 'u_aud', label: 'Auditor municipal', hint: 'Bitácora de auditoría (solo lectura)' },
  { key: 'u_consulta_obp', label: 'Consulta (Obras Públicas)', hint: 'Solo lectura de su dependencia' },
  { key: 'u_reg', label: 'Usuario sin membresía', hint: 'Usuario del ERP sin acceso municipal' },
];

const params = new URLSearchParams(window.location.search);

function DemoShell() {
  const [world, setWorld] = useState(null);
  const [generation, setGeneration] = useState(0);
  const [persona, setPersona] = useState(PERSONAS.some((p) => p.key === params.get('persona')) ? params.get('persona') : null);
  const [showUsers, setShowUsers] = useState(false);

  const reset = useCallback(async () => {
    setWorld(null);
    const w = await createServiceBackedWorld({ demo: true, save: (out) => savePrivateDocumentWeb(out.bytes, out.info) });
    window.__muniFolios = w.folios; // solo QA: folios sembrados
    setWorld(w);
    setGeneration((g) => g + 1);
  }, []);
  useEffect(() => { reset(); }, [reset]);

  const choose = (key) => {
    setPersona(key);
    const url = new URL(window.location.href);
    if (key) url.searchParams.set('persona', key); else url.searchParams.delete('persona');
    url.searchParams.delete('view');
    try { window.history.replaceState(null, '', url); } catch (_) { /* file:// en algunos navegadores */ }
  };

  const current = PERSONAS.find((p) => p.key === persona);
  const bar = (
    <View style={styles.bar} testID="demo-bar">
      <Text weight="bold" style={styles.barText} testID="demo-label">{DEMO_LABEL}</Text>
      <View style={styles.barRow}>
        <Text style={styles.barText} testID="demo-persona">{current ? `Perfil: ${current.label}` : 'Sin perfil elegido'}</Text>
        {persona ? <View style={styles.cell}><Button size="small" variant="secondary" label="Cambiar de perfil" onPress={() => choose(null)} testID="demo-change-persona" /></View> : null}
        <View style={styles.cell}><Button size="small" variant="secondary" label="Restablecer demostración" onPress={reset} testID="demo-reset" /></View>
        <View style={styles.cell}><Button size="small" variant="ghost" label={showUsers ? 'Ocultar usuarios de ejemplo' : 'Usuarios centrales de ejemplo'} onPress={() => setShowUsers((v) => !v)} testID="demo-users-toggle" textStyle={styles.barText} /></View>
      </View>
      {showUsers && world ? (
        <View style={styles.users} testID="demo-users">
          <Text style={styles.barText}>Identificadores sintéticos de la identidad central (para «Asignar usuario al municipio»):</Text>
          <Text style={styles.barText} selectable testID="demo-user-u_reg">{`Usuario sin membresía municipal: ${world.fx.USERS.u_reg}`}</Text>
          <Text style={styles.barText} selectable>{`Titular de otro municipio (ZZZ): ${world.fx.USERS.u_zzz_tit_obp}`}</Text>
          <Text style={styles.barText} selectable>{`Identificador inexistente (prueba de rechazo): ${'0'.repeat(20)}9999`}</Text>
        </View>
      ) : null}
    </View>
  );

  if (!world)
    return (
      <View style={styles.root}>
        {bar}
        <Text style={styles.pad} testID="demo-loading">Preparando datos de demostración…</Text>
      </View>
    );

  if (!persona)
    return (
      <View style={styles.root}>
        {bar}
        <View style={styles.pad} testID="demo-personas">
          <Text variant="heading2" accessibilityRole="header" aria-level={1}>MuniERP IA · Demostración</Text>
          <Text>Elija un perfil sintético. Cada perfil tiene los permisos reales de su rol municipal.</Text>
          <View accessibilityRole="list" style={styles.personaList}>
            {PERSONAS.map((p) => (
              <Pressable key={p.key} accessibilityRole="button" accessibilityLabel={`${p.label}. ${p.hint}`} onPress={() => choose(p.key)} style={styles.persona} testID={`demo-persona-${p.key}`}>
                <Text weight="bold">{p.label}</Text>
                <Text variant="caption" color="secondary">{p.hint}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    );

  const api = world.apiFor(persona, { latencyMs: Math.min(Number(params.get('latency')) || 0, 3000), failFirst: (params.get('fail') || '').split(',').filter(Boolean) });
  return (
    <View style={styles.root}>
      {bar}
      <MunicipalApp key={`${generation}-${persona}`} api={api} initialView={params.get('view') || 'home'} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: '100%' },
  bar: { backgroundColor: '#5c4400', paddingHorizontal: 16, paddingVertical: 8 },
  barText: { color: '#ffffff' },
  barRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 4 },
  cell: { paddingHorizontal: 4, paddingVertical: 4 },
  users: { marginTop: 6 },
  pad: { padding: 16 },
  personaList: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap' },
  persona: { minWidth: 240, minHeight: 64, margin: 6, padding: 12, borderWidth: 1, borderColor: '#cbd2d9', borderRadius: 8, backgroundColor: '#ffffff' },
});

document.documentElement.dataset.muniMode = 'demostracion-api-simulada';
createRoot(document.getElementById('root')).render(<DemoShell />);
