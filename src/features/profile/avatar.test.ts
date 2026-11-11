import { describe, expect, it } from 'vitest'
import { validateAvatarFile } from './avatar'

const file = (bytes: number, type: string, name = 'avatar') => new File([new Uint8Array(bytes)], name, { type })

describe('validateAvatarFile', () => {
  it('rejects files over 2 MB with the size message', () => {
    expect(validateAvatarFile(file(3 * 1024 * 1024, 'image/png'))).toEqual({
      ok: false,
      message: 'Arquivo maior que 2 MB.',
    })
  })

  it('rejects unsupported formats with the format message', () => {
    expect(validateAvatarFile(file(1024, 'image/gif'))).toEqual({
      ok: false,
      message: 'Formato não suportado. Use PNG, JPG ou WebP.',
    })
  })

  it('checks the format before the size', () => {
    expect(validateAvatarFile(file(3 * 1024 * 1024, 'image/gif'))).toEqual({
      ok: false,
      message: 'Formato não suportado. Use PNG, JPG ou WebP.',
    })
  })

  it('accepts a 100 KB webp', () => {
    expect(validateAvatarFile(file(100 * 1024, 'image/webp'))).toEqual({ ok: true })
  })

  it('accepts png and jpeg up to exactly 2 MB', () => {
    expect(validateAvatarFile(file(2 * 1024 * 1024, 'image/png'))).toEqual({ ok: true })
    expect(validateAvatarFile(file(1024, 'image/jpeg'))).toEqual({ ok: true })
  })
})
