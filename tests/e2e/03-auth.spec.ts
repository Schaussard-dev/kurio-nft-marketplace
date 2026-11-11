import type { Page } from '@playwright/test'
import { DEMO_USERS, expect, test } from './fixtures'

const loginForm = (page: Page) => page.getByRole('form', { name: 'Entrar' })
const registerForm = (page: Page) => page.getByRole('form', { name: 'Criar conta' })
const accountMenu = (page: Page, displayName: string) => page.getByRole('button', { name: `Menu de ${displayName}` })
const path = (page: Page) => {
  const url = new URL(page.url())
  return `${url.pathname}${url.search}`
}

async function fillLogin(page: Page, email: string, password: string) {
  const form = loginForm(page)
  await form.getByRole('textbox', { name: /^E-mail/ }).fill(email)
  await form.getByLabel(/^Senha/).fill(password)
  await form.getByRole('button', { name: 'Entrar', exact: true }).click()
}

async function signOut(page: Page, displayName: string) {
  await accountMenu(page, displayName).click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
}

test.describe('auth and session', () => {
  test('register validates on submit, focuses the first invalid field, then signs the user in', async ({
    page,
    gotoFresh,
  }) => {
    await gotoFresh('/cadastro')
    const form = registerForm(page)
    const submit = form.getByRole('button', { name: /^Criar (conta|perfil)$/ })
    await submit.click()

    const username = form.getByRole('textbox', { name: /^Nome de usuário/ })
    await expect(username).toBeFocused()
    // Spec §10: required fields say so to assistive tech.
    await expect(username).toHaveAttribute('aria-required', 'true')
    await expect(username).toHaveAccessibleName('Nome de usuário (obrigatório)')
    await expect(username).toHaveAttribute('aria-invalid', 'true')
    await expect(username).toHaveAccessibleDescription(/3 a 20 caracteres/)
    await expect(form.getByRole('textbox', { name: /^E-mail/ })).toHaveAttribute('aria-invalid', 'true')

    await username.fill('nova_colecionadora')
    await form.getByRole('textbox', { name: /^E-mail/ }).fill('nova@kurio.dev')
    await form.getByLabel(/^Senha/).fill('Kurio@2026')
    await form.getByLabel(/^Confirmar senha/).fill('Kurio@2026')
    await submit.click()

    await expect(page).toHaveURL('/')
    await expect(accountMenu(page, 'nova_colecionadora')).toBeVisible()
  })

  test('register with a taken e-mail shows the API field error', async ({ page, gotoFresh }) => {
    await gotoFresh('/cadastro')
    const form = registerForm(page)
    await form.getByRole('textbox', { name: /^Nome de usuário/ }).fill('outra_ana')
    const email = form.getByRole('textbox', { name: /^E-mail/ })
    await email.fill('ana@kurio.dev')
    await form.getByLabel(/^Senha/).fill('Kurio@2026')
    await form.getByLabel(/^Confirmar senha/).fill('Kurio@2026')
    await form.getByRole('button', { name: /^Criar (conta|perfil)$/ }).click()

    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription('E-mail já cadastrado')
    await expect(page).toHaveURL(/\/cadastro/)
  })

  test('wrong password shows an error and keeps the visitor signed out', async ({ page, gotoFresh }) => {
    await gotoFresh('/entrar')
    await fillLogin(page, 'ana@kurio.dev', 'Errada@2026')
    await expect(loginForm(page).getByRole('alert')).toHaveText('E-mail ou senha inválidos')
    await expect(page).toHaveURL(/\/entrar/)
  })

  test('login from a private route returns to it and survives a reload', async ({ page, gotoFresh }) => {
    await gotoFresh('/perfil')
    await expect(page).toHaveURL('/entrar?redirect=%2Fperfil')
    await fillLogin(page, DEMO_USERS.ana.email, DEMO_USERS.ana.password)

    await expect(page).toHaveURL('/perfil')
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
    await expect(accountMenu(page, 'Ana Souza')).toBeVisible()

    await page.reload()
    await expect(page).toHaveURL('/perfil')
    await expect(accountMenu(page, 'Ana Souza')).toBeVisible()
  })

  test('expired session (in-app navigation) sends the user to /entrar and back after login', async ({
    page,
    gotoFresh,
    mock,
    login,
  }) => {
    await gotoFresh('/')
    await login('ana')
    await page.goto('/perfil')
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()

    expect(await mock.emit({ action: 'session:expire' })).toBe(200)
    await page.getByRole('navigation', { name: 'Seções do perfil' }).getByRole('link', { name: 'Carteiras' }).click()

    await expect.poll(() => path(page)).toBe('/entrar?redirect=%2Fperfil%2Fcarteiras&reason=expired')
    await expect(page.getByRole('alert').filter({ hasText: 'Sua sessão expirou' })).toHaveText(
      'Sua sessão expirou. Entre novamente para continuar.',
    )
    // The client dropped the stored token.
    expect(await page.evaluate(() => localStorage.getItem('kurio-session'))).toBeNull()

    await fillLogin(page, DEMO_USERS.ana.email, DEMO_USERS.ana.password)
    await expect(page).toHaveURL('/perfil/carteiras')
    await expect(page.getByRole('heading', { level: 1, name: 'Carteiras' })).toBeVisible()
  })

  test('expired session (full reload) also lands on /entrar with the expiry notice', async ({
    page,
    gotoFresh,
    mock,
    login,
  }) => {
    await gotoFresh('/')
    await login('ana')
    expect(await mock.emit({ action: 'session:expire' })).toBe(200)

    await page.goto('/perfil/carteiras')
    await expect.poll(() => path(page)).toBe('/entrar?redirect=%2Fperfil%2Fcarteiras&reason=expired')
    await expect(page.getByRole('alert').filter({ hasText: 'Sua sessão expirou' })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('kurio-session'))).toBeNull()
  })

  test('logout clears the session and private routes redirect again', async ({ page, gotoFresh, login }) => {
    await gotoFresh('/')
    await login('ana')
    await signOut(page, 'Ana Souza')
    await expect(page).toHaveURL('/')

    await page.goto('/perfil')
    await expect(page).toHaveURL('/entrar?redirect=%2Fperfil')
  })

  test('switching users never shows the previous user', async ({ page, gotoFresh, login }) => {
    await gotoFresh('/')
    await login('ana')
    await signOut(page, 'Ana Souza')
    await login('bruno')

    await page.goto('/perfil')
    await expect(accountMenu(page, 'Bruno Lima')).toBeVisible()
    await expect(accountMenu(page, 'Ana Souza')).toHaveCount(0)
    await expect(page.getByText('Ana Souza')).toHaveCount(0)
  })

  test('an external redirect target is ignored after login', async ({ page, gotoFresh }) => {
    await gotoFresh('/entrar?redirect=https://evil.example')
    await fillLogin(page, DEMO_USERS.ana.email, DEMO_USERS.ana.password)
    await expect(accountMenu(page, 'Ana Souza')).toBeVisible()
    await expect(page).toHaveURL('/')
  })

  test('signed-in users visiting /entrar go to the redirect target', async ({ page, gotoFresh, login }) => {
    await gotoFresh('/')
    await login('ana')
    await page.goto('/entrar?redirect=%2Fperfil%2Ffavoritos')
    await expect(page).toHaveURL('/perfil/favoritos')
  })

  test('social login and password recovery are honest about being unavailable', async ({ page, gotoFresh }) => {
    await gotoFresh('/entrar')
    await page.getByRole('button', { name: 'Continuar com Google' }).click()
    await expect(page.getByText('Indisponível nesta demonstração').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Esqueceu a senha?' }).click()
    await expect(page.getByText('Indisponível nesta demonstração').first()).toBeVisible()
    await expect(page).toHaveURL('/entrar')
  })

  test('desktop shows a dialog over Início with tabs; mobile is a full page with a sign-up link', async ({
    page,
    gotoFresh,
    isMobile,
  }) => {
    await gotoFresh('/entrar')
    if (isMobile) {
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible()
      await page.getByRole('link', { name: 'Crie uma conta' }).click()
      await expect(page).toHaveURL('/cadastro')
      await expect(page.getByRole('heading', { level: 1, name: 'Criar perfil de colecionador' })).toBeVisible()
      return
    }
    const dialog = page.getByRole('dialog', { name: 'Entrar' })
    await expect(dialog).toBeVisible()
    await expect(page.getByTestId('nft-card').first()).toBeAttached()
    await expect(dialog.getByRole('textbox', { name: /^E-mail/ })).toBeFocused()
    await dialog.getByRole('link', { name: 'Criar conta' }).click()
    await expect(page).toHaveURL('/cadastro')
    await expect(page.getByRole('dialog', { name: 'Criar conta' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('closing the dialog returns to a public redirect target, never to a private one', async ({
    page,
    gotoFresh,
    isMobile,
  }) => {
    test.skip(isMobile, 'the dialog only exists at ≥768px')
    await gotoFresh('/entrar?redirect=%2Fnft%2Fnft_001')
    await expect(page.getByRole('dialog', { name: 'Entrar' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL('/nft/nft_001')

    await page.goto('/entrar?redirect=%2Fperfil%2Fcarteiras')
    await expect(page.getByRole('dialog', { name: 'Entrar' })).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click()
    await expect(page).toHaveURL('/')

    await page.goto('/entrar?redirect=https://evil.example')
    await expect(page.getByRole('dialog', { name: 'Entrar' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL('/')
  })
})
