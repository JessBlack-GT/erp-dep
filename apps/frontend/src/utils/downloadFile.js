/* global globalThis */
export function canDownloadFile() {
  return Boolean(
    globalThis.document &&
      globalThis.URL &&
      typeof globalThis.URL.createObjectURL === 'function' &&
      globalThis.Blob,
  );
}

export function downloadFile(response, fileName) {
  if (!canDownloadFile())
    throw new Error('La descarga de archivos solo está disponible en Web.');

  const pageDocument = globalThis.document;
  const urlApi = globalThis.URL;
  const BlobType = globalThis.Blob;

  const blob =
    response.data instanceof BlobType
      ? response.data
      : new BlobType([response.data], {
        type: response.headers?.['content-type'] || 'application/octet-stream',
      });
  const url = urlApi.createObjectURL(blob);
  const link = pageDocument.createElement('a');
  link.href = url;
  link.download = fileName;
  pageDocument.body.appendChild(link);
  link.click();
  link.remove();
  globalThis.setTimeout(() => urlApi.revokeObjectURL(url), 1000);
}
