import { StyleSheet } from 'react-native';
export const operations = {
  ENTRY: ['Entrada', 'entry'],
  EXIT: ['Salida', 'exit'],
  TRANSFER: ['Transferencia', 'transfer'],
  ADJUSTMENT: ['Ajuste', 'adjust'],
};
export const message = (e) =>
  e.response?.status === 403
    ? 'Sin permiso para esta operación'
    : e.response?.data?.error || 'No se pudo completar la operación';
export const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F5F5F5' },
  title: { fontSize: 24, fontWeight: 'bold', marginVertical: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  input: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#AAA',
    backgroundColor: '#FFF',
    borderRadius: 4,
    marginVertical: 5,
  },
  card: {
    padding: 12,
    backgroundColor: '#FFF',
    marginVertical: 5,
    borderRadius: 6,
  },
  error: { color: '#A00', marginVertical: 8 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
});
