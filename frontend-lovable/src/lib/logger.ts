/**
 * Logger — só emite console quando VITE_DEBUG=true.
 * Use em todo código de debug para não poluir o console em produção.
 */

const isDebug = import.meta.env.VITE_DEBUG === 'true';

export const logger = {
  /** Só loga se VITE_DEBUG=true */
  debug: (...args: unknown[]) => {
    if (isDebug) console.log(...args);
  },
  /** Só loga se VITE_DEBUG=true */
  warn: (...args: unknown[]) => {
    if (isDebug) console.warn(...args);
  },
  /** Erros: em produção pode ser útil manter; aqui só em debug para seguir a regra. */
  error: (...args: unknown[]) => {
    if (isDebug) console.error(...args);
  },
  /** Verificação para código que decide exibir logs */
  isDebug: () => isDebug,
};
