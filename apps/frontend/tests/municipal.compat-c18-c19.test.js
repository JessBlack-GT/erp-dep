/**
 * MuniERP IA — compatibilidad con las correcciones de Codex a Card (C-18) e Input (C-19), con el
 * núcleo ACTUAL de este repositorio. La variante con el Card corregido está en
 * municipal.compat-c18-corregido.test.js; ambas comparten los casos de municipal-compat-cases.js.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { render } from '@testing-library/react-native';
import { RequestIntakeForm } from '../src/features/municipal';
import { defineC18Cases } from './municipal-compat-cases';

defineC18Cases('actual');

describe('C-19 — Input', () => {
  test('el campo Asunto se identifica por su etiqueta y el código municipal no fija el rol', () => {
    const view = render(<RequestIntakeForm api={{}} dependencies={[{ code: 'OBP', name: 'Obras Públicas' }]} citizens={[]} onCreated={() => {}} />);
    const field = view.getByLabelText('Asunto');
    // Núcleo actual: 'search' (defecto C-19). Núcleo corregido: sin rol (campo de texto nativo). Ambos
    // válidos aquí: el módulo municipal no compensa ni sobrescribe el rol, así que no hay ajuste que retirar.
    expect(['search', undefined]).toContain(field.props.accessibilityRole);
  });

  test('ningún archivo municipal declara accessibilityRole="search" ni redefine Input', () => {
    const dir = path.join(__dirname, '../src/features/municipal');
    const files = [];
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : files.push(path.join(d, e.name))));
    walk(dir);
    const offenders = files.filter((f) => f.endsWith('.js')).filter((f) => {
      const src = fs.readFileSync(f, 'utf8');
      return /accessibilityRole=["']search["']/.test(src) || /function Input\b/.test(src);
    });
    expect(offenders).toEqual([]);
  });
});
