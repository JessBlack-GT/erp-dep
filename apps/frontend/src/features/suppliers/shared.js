import { StyleSheet } from 'react-native';
export const fields = [
  ['name', 'Nombre / razón social', 255],
  ['tradeName', 'Nombre comercial', 255],
  ['taxId', 'Identificador fiscal', 80],
  ['taxType', 'Tipo fiscal (VAT, RFC, RUC...)', 40],
  ['taxCountry', 'País fiscal (2 letras)', 2],
  ['email', 'Correo empresarial', 254],
  ['phone', 'Teléfono', 30],
  ['contactName', 'Contacto principal', 200],
  ['address', 'Dirección', 500],
  ['city', 'Ciudad', 100],
  ['region', 'Estado / provincia', 100],
  ['country', 'País (2 letras)', 2],
  ['zipCode', 'Código postal', 20],
  ['website', 'Sitio web', 500],
  ['paymentTerms', 'Condiciones de pago', 200],
  ['currency', 'Moneda (3 letras)', 3],
  ['category', 'Categoría', 100],
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
