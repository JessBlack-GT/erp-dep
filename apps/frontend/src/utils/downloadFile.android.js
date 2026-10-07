import { Alert, NativeModules, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

const MIME_TYPES = {
  pdf: 'application/pdf',
  xlsx:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function canDownloadFile() {
  return Boolean(
    Platform.OS === 'android' &&
      NativeModules.ReactNativeBlobUtil &&
      ReactNativeBlobUtil.fetch &&
      ReactNativeBlobUtil.android?.actionViewIntent,
  );
}

export async function downloadFile(request, fileName) {
  if (!canDownloadFile())
    throw new Error('La descarga de archivos no está disponible en Android.');

  const extension = fileName.split('.').pop()?.toLowerCase();
  const mimeType = MIME_TYPES[extension];
  if (!mimeType) throw new Error('Formato de reporte no compatible.');

  const title = fileName.slice(0, -(extension.length + 1));
  const response = await ReactNativeBlobUtil.config({
    appendExt: extension,
    addAndroidDownloads: {
      useDownloadManager: true,
      title,
      description: 'Reporte de inventario',
      mime: mimeType,
      mediaScannable: true,
      notification: true,
      storeInDownloads: Number(Platform.Version) >= 29,
    },
  }).fetch('GET', request.url, request.headers);

  const status = response.info()?.status;
  if (status && (status < 200 || status >= 300))
    throw new Error(`No se pudo descargar el reporte (HTTP ${status}).`);

  const fileUri = response.path();
  if (!fileUri) throw new Error('El servidor no entregó el archivo del reporte.');

  try {
    await ReactNativeBlobUtil.android.actionViewIntent(
      fileUri,
      mimeType,
      'Abrir reporte',
    );
  } catch (error) {
    if (error?.code !== 'ENOAPP' && !String(error).includes('ENOAPP')) throw error;
    Alert.alert(
      'Reporte descargado',
      'El archivo se guardó en Descargas, pero no hay una aplicación compatible para abrirlo.',
    );
    return;
  }

  Alert.alert('Reporte descargado', 'El archivo se guardó en Descargas.');
}
