import { StyleSheet } from 'react-native';
export const fields = [
  ['name', 'Nombre', 255],
  ['sku', 'SKU', 80],
  ['description', 'Descripción', 2000],
  ['barcode', 'Código de barras', 80],
  ['category', 'Categoría', 100],
  ['unit', 'Unidad', 40],
  ['price', 'Precio base', 17],
  ['cost', 'Costo base', 17],
  ['currency', 'Moneda (3 letras)', 3],
  ['taxCategory', 'Referencia fiscal', 80],
  ['notes', 'Notas', 2000],
];
export const message = (error) =>
  error.response?.status === 403
    ? 'Sin permiso para esta operación'
    : error.response?.data?.error || 'No se pudo completar la operación';
export const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F5F5F5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  input: {
    backgroundColor: '#FFF',
    padding: 12,
    borderWidth: 1,
    borderColor: '#BBB',
    borderRadius: 6,
    marginVertical: 6,
  },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginVertical: 8 },
  card: {
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginVertical: 6,
  },
  error: { color: '#B71C1C', marginVertical: 8 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
});
