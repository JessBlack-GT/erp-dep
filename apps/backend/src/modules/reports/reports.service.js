/* eslint-env node, es2020 */
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const sales = require('../sales/sales.service');
const inventory = require('../inventory/inventory.service');
const { ValidationError } = require('../../shared/errors/appErrors');

const PAGE_SIZE = 100;
const MAX_EXPORT_ROWS = 10000;

async function collect(fetchPage, filters) {
  const first = await fetchPage({ ...filters, page: 1, limit: PAGE_SIZE });
  const total = first.pagination.total;
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('Invalid report row count');
  if (total > MAX_EXPORT_ROWS)
    throw new ValidationError(
      `El reporte supera el límite de ${MAX_EXPORT_ROWS} registros; aplique filtros.`,
    );

  const rows = [...first.data];
  for (let page = 2; rows.length < total; page++) {
    const result = await fetchPage({
      ...filters,
      page,
      limit: PAGE_SIZE,
    });
    if (!result.data.length) throw new Error('No se pudo completar la exportación del reporte');
    rows.push(...result.data);
  }
  return rows.slice(0, total);
}

function dateValue(value) {
  return value ? new Date(value) : '';
}

function workbook(title, columns, rows) {
  const book = new ExcelJS.Workbook();
  book.creator = 'ERP';
  book.created = new Date();
  const sheet = book.addWorksheet(title);
  sheet.columns = columns;
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return book.xlsx.writeBuffer().then((buffer) => Buffer.from(buffer));
}

function printable(value) {
  return String(value ?? '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[^\x20-\xff]/g, ' ');
}

function pdf(title, headers, rows) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));

    document.fontSize(16).text(title);
    document.moveDown(0.4);
    document.fontSize(9).text(`Registros: ${rows.length}`);
    document.moveDown();
    document.font('Helvetica-Bold').text(headers.map(printable).join(' | '));
    document.moveDown(0.4);
    document.font('Helvetica');
    rows.forEach((row, index) => {
      if (document.y > document.page.height - document.page.margins.bottom - 50) document.addPage();
      document.fontSize(8).text(`${index + 1}. ${row.map(printable).join(' | ')}`);
      document.moveDown(0.25);
    });
    document.end();
  });
}

function salesData(row) {
  return [
    dateValue(row.date),
    row.number,
    row.entity?.name || '',
    row.status,
    row.subtotal,
    row.discountTotal,
    row.taxTotal,
    row.total,
    row.currency,
  ];
}

function inventoryData(view, row) {
  const product = row.productId || {};
  if (view === 'balances')
    return [
      product.name || '',
      product.sku || '',
      row.warehouseId?.name || '',
      row.available,
      product.unit || '',
    ];
  return [
    dateValue(row.createdAt),
    row.type,
    product.name || '',
    product.sku || '',
    row.quantity,
    product.unit || '',
    row.sourceWarehouseId?.name || '',
    row.destinationWarehouseId?.name || '',
    row.reason,
    row.reference,
  ];
}

class ReportsService {
  async sales(filters, format, actor) {
    if (!['pdf', 'xlsx'].includes(format)) throw new ValidationError('Formato de reporte inválido');
    const rows = await collect(
      (query) =>
        sales.getAll({ ...query, page: String(query.page), limit: String(query.limit) }, actor),
      filters,
    );
    const title = 'Reporte de ventas';
    const columns = [
      { header: 'Fecha', key: 'date', width: 14 },
      { header: 'Número', key: 'number', width: 22 },
      { header: 'Cliente', key: 'entity', width: 30 },
      { header: 'Estado', key: 'status', width: 14 },
      { header: 'Subtotal', key: 'subtotal', width: 16 },
      { header: 'Descuento', key: 'discount', width: 16 },
      { header: 'Impuestos', key: 'tax', width: 16 },
      { header: 'Total', key: 'total', width: 16 },
      { header: 'Moneda', key: 'currency', width: 12 },
    ];
    const data = rows.map(salesData);
    const buffer =
      format === 'pdf'
        ? await pdf(
          title,
          columns.map((column) => column.header),
          data,
        )
        : await workbook(
          'Ventas',
          columns,
          data.map((row) => ({
            date: row[0],
            number: row[1],
            entity: row[2],
            status: row[3],
            subtotal: row[4],
            discount: row[5],
            tax: row[6],
            total: row[7],
            currency: row[8],
          })),
        );
    return {
      buffer,
      contentType:
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `ventas-${new Date().toISOString().slice(0, 10)}.${format}`,
    };
  }

  async inventory(view, filters, format) {
    if (!['balances', 'movements'].includes(view))
      throw new ValidationError('Vista de inventario inválida');
    if (!['pdf', 'xlsx'].includes(format)) throw new ValidationError('Formato de reporte inválido');
    const rows = await collect((query) => inventory.list(view, query), filters);
    const balances = view === 'balances';
    const title = balances ? 'Reporte de existencias' : 'Movimientos de inventario';
    const columns = balances
      ? [
        { header: 'Producto', key: 'product', width: 30 },
        { header: 'SKU', key: 'sku', width: 18 },
        { header: 'Almacén', key: 'warehouse', width: 24 },
        { header: 'Existencia', key: 'quantity', width: 16 },
        { header: 'Unidad', key: 'unit', width: 14 },
      ]
      : [
        { header: 'Fecha', key: 'date', width: 22 },
        { header: 'Tipo', key: 'type', width: 14 },
        { header: 'Producto', key: 'product', width: 30 },
        { header: 'SKU', key: 'sku', width: 18 },
        { header: 'Cantidad', key: 'quantity', width: 16 },
        { header: 'Unidad', key: 'unit', width: 14 },
        { header: 'Origen', key: 'source', width: 24 },
        { header: 'Destino', key: 'destination', width: 24 },
        { header: 'Motivo', key: 'reason', width: 32 },
        { header: 'Referencia', key: 'reference', width: 24 },
      ];
    const data = rows.map((row) => inventoryData(view, row));
    const buffer =
      format === 'pdf'
        ? await pdf(
          title,
          columns.map((column) => column.header),
          data,
        )
        : await workbook(
          balances ? 'Existencias' : 'Movimientos',
          columns,
          data.map((row) =>
            balances
              ? {
                product: row[0],
                sku: row[1],
                warehouse: row[2],
                quantity: row[3],
                unit: row[4],
              }
              : {
                date: row[0],
                type: row[1],
                product: row[2],
                sku: row[3],
                quantity: row[4],
                unit: row[5],
                source: row[6],
                destination: row[7],
                reason: row[8],
                reference: row[9],
              },
          ),
        );
    return {
      buffer,
      contentType:
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `inventario-${view}-${new Date().toISOString().slice(0, 10)}.${format}`,
    };
  }
}

module.exports = new ReportsService();
