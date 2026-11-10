/**
 * Casos compartidos de compatibilidad C-18 (Card) para el módulo municipal. Los usan
 * municipal.compat-c18-c19.test.js (núcleo ACTUAL) y municipal.compat-c18-corregido.test.js (réplica de
 * prueba del Card CORREGIDO por Codex). No es un archivo de prueba por sí mismo.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { RequestList } from '../src/features/municipal/components/RequestList';
import { ReceiptView } from '../src/features/municipal/components/ReceiptView';
import { requestAccessibilityLabel } from '../src/features/municipal/model';

export const folio = 'SJH-OBP-SOL-2026-000001';
const row = { folio, status: 'EN_TRAMITE', ownerDependency: 'OBP', subject: 'Asunto sintético', createdAt: '2026-10-05T16:00:00.000Z' };
const receipt = {
  folio, municipality: 'San Juan Huactzinco', dependency: 'Obras Públicas', subject: 'Asunto sintético', status: 'REGISTRADA',
  channel: 'PRESENCIAL', registeredAt: '2026-10-05T16:00:00.000Z', instructions: 'Conserve este folio.',
};

export function defineC18Cases(version) {
  describe(`C-18 — Card ${version}`, () => {
    test('fila de lista estática: la etiqueta del expediente se anuncia exactamente una vez', () => {
      const view = render(<RequestList items={[row]} />);
      expect(view.queryAllByLabelText(requestAccessibilityLabel(row))).toHaveLength(1);
      expect(view.getByTestId(`request-${folio}`).props.accessibilityRole).toBe('listitem');
    });

    test('fila interactiva: una sola etiqueta, en el botón', () => {
      const view = render(<RequestList items={[row]} onSelect={() => {}} />);
      const labelled = view.queryAllByLabelText(requestAccessibilityLabel(row));
      expect(labelled).toHaveLength(1);
      expect(labelled[0].props.accessibilityRole).toBe('button');
    });

    test('acuse: sin etiqueta de contenedor (no duplica el folio ni agrupa botones) y con encabezado', () => {
      const view = render(<ReceiptView receipt={receipt} onDone={() => {}} />);
      expect(view.queryAllByLabelText(/Acuse de solicitud/)).toHaveLength(0);
      expect(view.getByTestId('municipal-receipt').props.accessibilityLabel).toBeUndefined();
      expect(view.getByRole('header', { name: 'Acuse de solicitud' })).toBeTruthy();
      expect(view.getByTestId('receipt-folio')).toHaveTextContent(folio);
      expect(view.getByTestId('receipt-done')).toBeTruthy();
    });
  });
}
