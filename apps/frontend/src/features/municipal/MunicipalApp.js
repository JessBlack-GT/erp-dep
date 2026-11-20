/**
 * MuniERP IA — aplicación municipal navegable (F1-15a, preparación de la demostración).
 *
 * Reúne las pantallas existentes sin reconstruirlas: registro (RequestIntakeForm + ReceiptView),
 * listado (RequestBrowser → RequestList), detalle e historial (RequestDetail, F1-13), auditoría
 * (AuditLog, F1-14), y las nuevas de administración (DependencyAdmin, MembershipAdmin).
 *
 * - La navegación muestra solo las secciones que permiten los permisos de /me/memberships (UX); cada
 *   pantalla vuelve a consultar al servidor, que autoriza (403/404 se muestran tal cual).
 * - `api` es intercambiable: API simulada (demostración, datos sintéticos) o `createMunicipalApi`
 *   (HTTP real contra /api/municipal/v1 cuando el anfitrión de Codex la monte, C-01).
 * - `modeLabel` identifica el modo en pantalla; en demostración es obligatorio mostrarlo.
 * - Encabezados: un solo nivel 1 por pantalla (el título de la pantalla); secciones nivel 2.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, View, StyleSheet, useWindowDimensions } from 'react-native';
import { Text, Button, Input, LoadingSpinner } from '../../components/common';
import { semanticColors, spacing } from '../../theme';
import { IndicatorsPanel } from './components/IndicatorsPanel';
import { RequestList } from './components/RequestList';
import { RequestIntakeForm } from './components/RequestIntakeForm';
import { ReceiptView } from './components/ReceiptView';
import { RequestDetail } from './components/RequestDetail';
import { RequestBrowser } from './components/RequestBrowser';
import { AuditLog } from './components/AuditLog';
import { DependencyAdmin } from './components/DependencyAdmin';
import { MembershipAdmin } from './components/MembershipAdmin';
import { Heading, Section, ButtonRow } from './components/Section';
import { navSections, roleLabel, describeApiError } from './model';

function Home({ api, membership, permissions, sections, dependencies = [], onNavigate, onOpen }) {
  const [data, setData] = useState({ loading: true, indicators: null, recent: [], error: '' });
  const load = useCallback(async () => {
    setData((d) => ({ ...d, loading: true, error: '' }));
    try {
      const [indicators, recent] = await Promise.all([
        permissions.has('municipal.indicators.read') ? api.getIndicators() : Promise.resolve(null),
        permissions.has('municipal.requests.read') ? api.listRequests({ page: 1, limit: 5 }) : Promise.resolve({ items: [] }),
      ]);
      setData({ loading: false, indicators, recent: recent.items, error: '' });
    } catch (e) {
      setData({ loading: false, indicators: null, recent: [], error: describeApiError(e).message });
    }
  }, [api, permissions]);
  useEffect(() => { load(); }, [load]);

  const deps = (membership.dependencies || []).map((c) => (dependencies.find((d) => d.code === c) || {}).name || c).join(', ');
  return (
    <View testID="app-home">
      <Heading level={1} testID="home-title">Panel principal</Heading>
      <Text testID="home-role">{`${roleLabel(membership.role)}${deps ? ` · ${deps}` : ' · todo el municipio'}`}</Text>
      <Section title="Accesos rápidos" testID="home-shortcuts">
        <ButtonRow>
          {sections.filter((s) => s.key !== 'home').map((s) => (
            <Button key={s.key} variant="secondary" label={s.label} onPress={() => onNavigate(s.key)} testID={`home-go-${s.key}`} />
          ))}
        </ButtonRow>
        {sections.length === 1 ? <Text testID="home-no-sections">Su rol no tiene secciones adicionales en este municipio.</Text> : null}
      </Section>
      {data.loading ? <LoadingSpinner label="Cargando panel…" testID="home-loading" /> : null}
      {data.error ? (
        <View>
          <Text color="error" accessibilityRole="alert" testID="home-error">{data.error}</Text>
          <Button variant="secondary" label="Reintentar" onPress={load} testID="home-retry" />
        </View>
      ) : null}
      {!data.loading && data.indicators ? <IndicatorsPanel data={data.indicators} headingLevel={2} /> : null}
      {!data.loading && permissions.has('municipal.requests.read') && !data.error ? (
        <Section title="Solicitudes recientes" testID="home-recent">
          <RequestList items={data.recent} onSelect={(r) => onOpen(r.folio)} testID="home-recent-list" />
        </Section>
      ) : null}
    </View>
  );
}

function Intake({ api, permissions, dependencies, onOpen }) {
  const [citizens, setCitizens] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [newCitizen, setNewCitizen] = useState(null);
  const [savingCitizen, setSavingCitizen] = useState(false);
  const [citizenError, setCitizenError] = useState('');
  const mayCreateCitizen = permissions.has('municipal.citizens.create') && typeof api.createCitizen === 'function';

  async function saveCitizen() {
    setCitizenError('');
    const fullName = newCitizen.trim();
    if (fullName.length < 3) { setCitizenError('Introduzca el nombre completo.'); return; }
    setSavingCitizen(true);
    try {
      const saved = await api.createCitizen({ fullName });
      setCitizens((current) => [...current.filter((c) => c.id !== saved.id), saved]);
      setNewCitizen(null);
    } catch (e) {
      setCitizenError(describeApiError(e).message);
    } finally {
      setSavingCitizen(false);
    }
  }
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    (permissions.has('municipal.citizens.read') ? api.searchCitizens() : Promise.resolve([]))
      .then((c) => { if (alive) setCitizens(c); })
      .catch((e) => { if (alive) { setCitizens([]); setError(describeApiError(e).message); } });
    return () => { alive = false; };
  }, [api, permissions]);
  if (!citizens) return <LoadingSpinner label="Cargando formulario…" testID="intake-loading" />;
  if (receipt)
    return (
      <View testID="app-receipt">
        <Heading level={1}>Solicitud registrada</Heading>
        <ReceiptView receipt={receipt} onDone={() => { setReceipt(null); setFormKey((k) => k + 1); }} />
        {permissions.has('municipal.requests.read') ? (
          <ButtonRow>
            <Button variant="secondary" label="Abrir expediente" onPress={() => onOpen(receipt.folio)} testID="receipt-open" />
          </ButtonRow>
        ) : null}
      </View>
    );
  return (
    <View testID="app-intake">
      {error ? <Text color="error" accessibilityRole="alert">{error}</Text> : null}
      {mayCreateCitizen ? (
        <Section title="Alta de ciudadano">
          {newCitizen === null ? (
            <Button variant="secondary" label="Registrar ciudadano" onPress={() => setNewCitizen('')} testID="intake-new-citizen" />
          ) : (
            <View>
              <Input label="Nombre completo" maxLength={160} value={newCitizen} onChangeText={setNewCitizen} testID="intake-citizen-name" />
              {citizenError ? <Text accessibilityRole="alert" color="error">{citizenError}</Text> : null}
              <ButtonRow>
                <Button label="Guardar ciudadano" loading={savingCitizen} onPress={saveCitizen} testID="intake-save-citizen" />
                <Button variant="ghost" label="Cancelar alta" disabled={savingCitizen} onPress={() => setNewCitizen(null)} />
              </ButtonRow>
            </View>
          )}
        </Section>
      ) : null}
      <RequestIntakeForm key={formKey} api={api} dependencies={dependencies} citizens={citizens} headingLevel={1} onCreated={async (created) => setReceipt(await api.getReceipt(created.folio))} />
    </View>
  );
}

function NavBar({ sections, current, onNavigate, vertical }) {
  return (
    <View accessibilityRole="navigation" accessibilityLabel="Secciones de MuniERP" style={[styles.nav, vertical && styles.navVertical]} testID="app-nav">
      {sections.map((s) => {
        const active = s.key === current;
        return (
          <View key={s.key} style={vertical ? styles.navCellVertical : styles.navCell}>
            <Button
              variant={active ? 'primary' : 'ghost'}
              label={s.label}
              onPress={() => onNavigate(s.key)}
              aria-current={active ? 'page' : undefined}
              fullWidth={vertical}
              testID={`nav-${s.key}`}
            />
          </View>
        );
      })}
    </View>
  );
}

export function MunicipalApp({ api, modeLabel, initialView = 'home', membershipId, testID = 'municipal-app' }) {
  const { width } = useWindowDimensions();
  const wide = width >= 1024;
  const [boot, setBoot] = useState({ loading: true, error: '', memberships: [], dependencies: [] });
  const [view, setView] = useState(initialView);
  const [folio, setFolio] = useState(null);
  const [returnTo, setReturnTo] = useState('home');

  const load = useCallback(async () => {
    setBoot((b) => ({ ...b, loading: true, error: '' }));
    try {
      const available = await api.myMemberships();
      const memberships = membershipId ? available.filter((item) => item.id === membershipId) : available;
      const dependencies = memberships.length ? await api.listDependencies({}).catch(() => []) : [];
      setBoot({ loading: false, error: '', memberships, dependencies });
    } catch (e) {
      setBoot({ loading: false, error: describeApiError(e).message, memberships: [], dependencies: [] });
    }
  }, [api, membershipId]);
  useEffect(() => { load(); }, [load]);
  // Al cambiar de pantalla se vuelve al inicio del documento (web).
  useEffect(() => { if (Platform.OS === 'web' && typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0); }, [view, folio]);

  const membership = boot.memberships[0];
  const permissions = useMemo(() => new Set((membership && membership.permissions) || []), [membership]);
  const sections = useMemo(() => navSections((membership && membership.permissions) || []), [membership]);
  const navigate = (key) => { setFolio(null); setView(key); };
  const open = (f) => { setReturnTo(view); setFolio(f); };
  const activeDeps = boot.dependencies.filter((d) => d.status !== 'INACTIVA');

  const mode = modeLabel ? <Text variant="caption" style={styles.mode} testID="app-mode">{modeLabel}</Text> : null;
  if (boot.loading) return <View style={styles.page}>{mode}<LoadingSpinner label="Cargando MuniERP…" testID="app-loading" /></View>;
  if (boot.error)
    return (
      <View style={styles.page} testID="app-error">
        {mode}
        <Text color="error" accessibilityRole="alert">{boot.error}</Text>
        <Button label="Reintentar" onPress={load} testID="app-retry" />
      </View>
    );
  if (!membership)
    return (
      <View style={styles.page} testID="app-no-membership">
        {mode}
        <Heading level={1}>MuniERP IA</Heading>
        <Text>No tiene una membresía municipal vigente. Solicítela al administrador municipal.</Text>
      </View>
    );

  // Si la sección pedida no está permitida para este rol, se muestra el panel.
  const current = sections.some((s) => s.key === view) ? view : 'home';
  let screen;
  if (folio) {
    screen = <RequestDetail api={api} folio={folio} membership={membership} dependencies={activeDeps} onBack={() => { setFolio(null); setView(returnTo); }} />;
  } else if (current === 'intake') {
    screen = <Intake api={api} permissions={permissions} dependencies={activeDeps} onOpen={open} />;
  } else if (current === 'requests') {
    screen = <RequestBrowser api={api} dependencies={boot.dependencies} onOpen={open} />;
  } else if (current === 'dependencies') {
    screen = <DependencyAdmin api={api} membership={membership} />;
  } else if (current === 'memberships') {
    screen = <MembershipAdmin api={api} membership={membership} dependencies={boot.dependencies} />;
  } else if (current === 'audit') {
    screen = <AuditLog api={api} membership={membership} dependencies={boot.dependencies} />;
  } else {
    screen = <Home api={api} membership={membership} permissions={permissions} sections={sections} dependencies={boot.dependencies} onNavigate={navigate} onOpen={open} />;
  }

  return (
    <View style={styles.app} testID={testID}>
      <View style={styles.header} testID="app-header">
        <Text weight="bold" color="inverse">{`MuniERP IA · ${membership.municipality.name}`}</Text>
        <Text variant="caption" color="inverse" testID="app-role">{roleLabel(membership.role)}</Text>
      </View>
      {mode}
      <View style={[styles.body, wide && styles.bodyWide]}>
        <View style={wide ? styles.sidebar : styles.topnav}>
          <NavBar sections={sections} current={folio ? 'requests' : current} onNavigate={navigate} vertical={wide} />
        </View>
        {/* El documento completo se desplaza (sin ScrollView interno): en celular la cabecera no ocupa la pantalla. */}
        <View style={[styles.main, styles.mainContent]} testID="app-main" accessibilityRole="main">
          {screen}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flexGrow: 1, backgroundColor: semanticColors.surface.secondary || '#f5f7fa' },
  page: { padding: spacing.md },
  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: '#0f2747' },
  mode: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: '#fff4ce', color: '#5c4400' },
  body: { flexGrow: 1, flexDirection: 'column' },
  bodyWide: { flexDirection: 'row' },
  sidebar: { width: 240, padding: spacing.sm, borderRightWidth: 1, borderRightColor: '#d9e2ec', backgroundColor: '#ffffff' },
  topnav: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: '#d9e2ec', backgroundColor: '#ffffff' },
  nav: { flexDirection: 'row', flexWrap: 'wrap' },
  navVertical: { flexDirection: 'column' },
  navCell: { padding: spacing.xs / 2 },
  navCellVertical: { paddingVertical: spacing.xs / 2 },
  main: { flexGrow: 1, flexShrink: 1 },
  mainContent: { padding: spacing.md, maxWidth: 1200, width: '100%' },
});

export default MunicipalApp;
