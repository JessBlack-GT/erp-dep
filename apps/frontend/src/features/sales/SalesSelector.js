import React from 'react';
import PropTypes from 'prop-types';
import { Text } from 'react-native';
import { InventorySelector } from '../inventory/InventorySelector';
import {
  customerService,
  productService,
  inventoryService,
} from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { active, salesError } from './shared';

const loaders = {
  customer: (params) => customerService.getAll({ ...params, status: 'active' }),
  product: (params) => productService.getAll({ ...params, status: 'active' }),
  warehouse: (params) =>
    inventoryService.getWarehouses({ ...params, status: 'active' }),
};
const permissions = {
  customer: 'customers.read',
  product: 'products.read',
  warehouse: 'inventory.read',
};
const labels = {
  customer: (x) =>
    x.businessName || [x.name, x.lastName].filter(Boolean).join(' '),
  product: (x) =>
    [
      x.name,
      x.sku,
      x.type === 'SERVICE' ? 'Servicio' : 'Producto',
      x.unit,
      x.price != null ? `${x.price} ${x.currency || ''}` : 'Sin precio',
    ].join(' · '),
  warehouse: (x) => [x.name, x.code].filter(Boolean).join(' · '),
};
export function SalesSelector({ kind, label, value, onSelect, disabled }) {
  const can = usePermissions();
  if (!can(permissions[kind]))
    return (
      <Text>
        Se requiere permiso {permissions[kind]} para seleccionar {label}.
      </Text>
    );
  return (
    <InventorySelector
      kind={kind}
      label={label}
      value={value}
      onSelect={onSelect}
      disabled={disabled}
      fetchOptions={loaders[kind]}
      formatOption={labels[kind]}
      isEligible={active}
      errorMessage={salesError}
    />
  );
}
SalesSelector.propTypes = {
  kind: PropTypes.oneOf(['customer', 'product', 'warehouse']).isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.object,
  onSelect: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};
