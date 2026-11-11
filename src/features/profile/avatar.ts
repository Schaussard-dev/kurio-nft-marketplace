export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export const AVATAR_FORMAT_MESSAGE = 'Formato não suportado. Use PNG, JPG ou WebP.'
export const AVATAR_SIZE_MESSAGE = 'Arquivo maior que 2 MB.'

export type AvatarValidation = { ok: true } | { ok: false; message: string }

/** Client-side check before anything is decoded or sent: format first, then size. */
export function validateAvatarFile(file: File): AvatarValidation {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return { ok: false, message: AVATAR_FORMAT_MESSAGE }
  if (file.size > AVATAR_MAX_BYTES) return { ok: false, message: AVATAR_SIZE_MESSAGE }
  return { ok: true }
}

/** Center-crops to a square and scales to `size` px on a canvas; returns an image/webp data URL (spec §9). */
export async function resizeToDataUrl(file: File, size = 256): Promise<string> {
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas indisponível')
    const side = Math.min(bitmap.width, bitmap.height)
    const sx = (bitmap.width - side) / 2
    const sy = (bitmap.height - side) / 2
    context.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
    return canvas.toDataURL('image/webp', 0.85)
  } finally {
    bitmap.close()
  }
}
