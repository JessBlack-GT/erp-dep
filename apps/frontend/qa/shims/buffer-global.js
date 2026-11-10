/** Inyecta Buffer global SOLO en el arnés web de QA (lo usa el servicio municipal en memoria). */
import { Buffer } from 'buffer';

if (typeof globalThis.Buffer === 'undefined') globalThis.Buffer = Buffer;
export { Buffer };
