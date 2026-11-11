import { DEMO_USERS, expect, test, waitForMocks } from './fixtures'

const AVATAR = 'tests/e2e/assets/avatar.png'

test.describe('perfil', () => {
  test.beforeEach(async ({ gotoFresh, login, page }) => {
    await gotoFresh('/')
    await login('ana')
    await page.goto('/perfil')
    await waitForMocks(page)
  })

  test('shows the profile form prefilled and the sidebar routes', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Perfil do colecionador' })).toBeVisible()
    const form = page.getByRole('form', { name: 'Dados do perfil' })
    const name = form.getByRole('textbox', { name: /^Nome de exibição/ })
    await expect(name).toHaveValue('Ana Souza')
    await expect(name).toHaveAttribute('aria-required', 'true')
    await expect(form.getByRole('textbox', { name: /^Nome de usuário/ })).toHaveValue('ana')
    await expect(form.getByRole('textbox', { name: /^E-mail/ })).toHaveValue('ana@kurio.dev')
    await expect(form.getByRole('textbox', { name: /^Apelido da carteira/ })).toHaveValue('Principal')

    const nav = page.getByRole('navigation', { name: 'Seções do perfil' })
    await nav.getByRole('link', { name: 'Atividade' }).click()
    await expect(page).toHaveURL(/\/em-breve\?secao=atividade/)
  })

  test('edits the display name and keeps it after a reload', async ({ page }) => {
    const form = page.getByRole('form', { name: 'Dados do perfil' })
    await form.getByRole('textbox', { name: /^Nome de exibição/ }).fill('Ana Colecionadora')
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Perfil atualizado')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Menu de Ana Colecionadora' })).toBeVisible()
    await page.reload()
    await waitForMocks(page)
    await expect(
      page.getByRole('form', { name: 'Dados do perfil' }).getByRole('textbox', { name: /^Nome de exibição/ }),
    ).toHaveValue('Ana Colecionadora')
    await expect(page.getByRole('button', { name: 'Menu de Ana Colecionadora' })).toBeVisible()
  })

  test('validates required fields on the client', async ({ page }) => {
    const form = page.getByRole('form', { name: 'Dados do perfil' })
    const name = form.getByRole('textbox', { name: /^Nome de exibição/ })
    await name.fill('')
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(name).toBeFocused()
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await expect(name).toHaveAccessibleDescription('Campo obrigatório')
  })

  test('rejects a whitespace-only display name', async ({ page }) => {
    const form = page.getByRole('form', { name: 'Dados do perfil' })
    const name = form.getByRole('textbox', { name: /^Nome de exibição/ })
    await name.fill('   ')
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await expect(name).toHaveAccessibleDescription('Campo obrigatório')
    await expect(page.getByText('Perfil atualizado')).toHaveCount(0)
  })

  test('saves an ENS name typed with .eth without doubling the suffix', async ({ page }) => {
    const form = page.getByRole('form', { name: 'Dados do perfil' })
    const ens = form.getByRole('textbox', { name: /^Nome ENS/ })
    await ens.fill('bad name')
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(ens).toHaveAttribute('aria-invalid', 'true')
    await ens.fill('foo.eth')
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Perfil atualizado')).toBeVisible()
    await page.reload()
    await waitForMocks(page)
    await expect(
      page.getByRole('form', { name: 'Dados do perfil' }).getByRole('textbox', { name: /^Nome ENS/ }),
    ).toHaveValue('foo')
  })

  test('rejects a taken username on the field', async ({ page }) => {
    const form = page.getByRole('form', { name: 'Dados do perfil' })
    const username = form.getByRole('textbox', { name: /^Nome de usuário/ })
    await username.fill('bruno')
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(username).toHaveAttribute('aria-invalid', 'true')
    await expect(username).toHaveAccessibleDescription('Nome de usuário indisponível')
    await expect(page.getByText('Perfil atualizado')).toHaveCount(0)
  })

  test('uploads an avatar (form and header) and removes it', async ({ page }) => {
    const field = page.getByRole('group', { name: 'Avatar' })
    await field.getByLabel('Alterar avatar').setInputFiles(AVATAR)
    await expect(field.getByRole('img', { name: 'Avatar de Ana Souza' })).toBeVisible()
    await expect(page.getByText('Avatar atualizado')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Menu de Ana Souza' }).locator('img')).toBeVisible()
    await page.reload()
    await waitForMocks(page)
    const again = page.getByRole('group', { name: 'Avatar' })
    await expect(again.getByRole('img', { name: 'Avatar de Ana Souza' })).toBeVisible()

    await again.getByRole('button', { name: 'Remover' }).click()
    await expect(again.getByRole('img')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Menu de Ana Souza' }).locator('img')).toHaveCount(0)
  })

  test('refuses an avatar over 2 MB without calling the API', async ({ page }) => {
    const calls: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/api/me/avatar')) calls.push(request.method())
    })
    const field = page.getByRole('group', { name: 'Avatar' })
    await field.getByLabel('Alterar avatar').setInputFiles({
      name: 'big.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
    })
    await expect(field.getByRole('alert')).toHaveText('Arquivo maior que 2 MB.')
    await expect(field.getByRole('button', { name: 'Alterar', exact: true })).toHaveAccessibleDescription(
      'Arquivo maior que 2 MB.',
    )
    await expect(field.getByRole('img')).toHaveCount(0)
    expect(calls).toEqual([])
  })

  test('changes the password: wrong current fails on the field, new one works after re-login', async ({ page }) => {
    test.setTimeout(60_000) // several full loads plus PBKDF2 hashing under parallel load
    const form = page.getByRole('form', { name: 'Alterar senha' })
    const current = form.getByLabel(/^Senha atual/)
    const next = form.getByLabel(/^Nova senha/)
    const confirm = form.getByLabel(/^Confirmar nova senha/)

    await current.fill('Errada@123')
    await next.fill('Novissima@2027')
    await confirm.fill('Novissima@2027')
    await form.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(current).toHaveAttribute('aria-invalid', 'true')
    await expect(current).toBeFocused()
    await expect(current).toHaveAccessibleDescription(/senha atual/i)

    await current.fill(DEMO_USERS.ana.password)
    await form.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('Senha alterada')).toBeVisible()
    await expect(current).toHaveValue('')
    await expect(next).toHaveValue('')
    await expect(confirm).toHaveValue('')

    // Real logout, then the old password fails and the new one signs in.
    await page.getByRole('complementary', { name: 'Menu do perfil' }).getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('link', { name: 'Entrar' }).first()).toBeVisible()
    await page.goto('/entrar')
    await waitForMocks(page)
    const login = page.getByRole('form', { name: 'Entrar' })
    await login.getByRole('textbox', { name: /^E-mail/ }).fill(DEMO_USERS.ana.email)
    await login.getByLabel(/^Senha/).fill(DEMO_USERS.ana.password)
    await login.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(login.getByRole('alert')).toHaveText('E-mail ou senha inválidos')
    await login.getByLabel(/^Senha/).fill('Novissima@2027')
    await login.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Menu de Ana Souza' })).toBeVisible()
  })
})
