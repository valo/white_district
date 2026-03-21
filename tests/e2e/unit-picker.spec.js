import { expect, test } from '@playwright/test'

const getPickerPanel = (page) => page.locator('.panel').first()
const getSelectedPanel = (page) => page.locator('.panel').nth(1)

const unitCard = (page, label) =>
  getPickerPanel(page).locator('.unit-card').filter({ hasText: label }).first()

const selectedItem = (page, label) =>
  getSelectedPanel(page).locator('.selected-item').filter({ hasText: label }).first()

const parseEuro = (value) =>
  Number(
    value
      .replace(/€/g, '')
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
  )

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('@preview @fees shows fee table changes after selecting a unit', async ({ page }) => {
  await unitCard(page, 'АП. 001').getByRole('button', { name: 'Добави' }).click()

  const feesTable = page.locator('table tbody tr')
  await expect(feesTable).toHaveCount(11)

  const firstRow = feesTable.first()
  await expect(firstRow.locator('td').nth(1)).toContainText('€/m²')
  await expect(firstRow.locator('td').nth(2)).toContainText('€/m²')
  await expect(firstRow.locator('td').nth(4)).toContainText('€')
  await expect(firstRow.locator('td').nth(5)).toContainText('€')
  await expect(firstRow.locator('td').nth(6)).toContainText('€')
})

test('@preview @fees includes non-vat repair fund in the final total', async ({ page }) => {
  await unitCard(page, 'АП. 001').getByRole('button', { name: 'Добави' }).click()

  const firstRow = page.locator('table tbody tr').first()
  const maintenance = parseEuro(await firstRow.locator('td').nth(3).innerText())
  const repairFund = parseEuro(await firstRow.locator('td').nth(4).innerText())
  const vat = parseEuro(await firstRow.locator('td').nth(5).innerText())
  const total = parseEuro(await firstRow.locator('td').nth(6).innerText())

  expect(total).toBeCloseTo(maintenance + repairFund + vat, 2)
})

test('@preview @unit-picker adds units to selected list and updates selected count', async ({ page }) => {
  await expect(page.getByText('Няма избрани имоти. Добавете от списъка.')).toBeVisible()

  const card = unitCard(page, 'АП. 001')
  await card.getByRole('button', { name: 'Добави' }).click()

  await expect(selectedItem(page, 'АП. 001')).toBeVisible()
  await expect(page.locator('.hero-metric').filter({ hasText: 'Избрани имоти' }).locator('.metric-value')).toHaveText('1')

  await expect(card.getByRole('button', { name: 'Добавено' })).toBeDisabled()
})

test('removes units from selected list and resets empty state', async ({ page }) => {
  const card = unitCard(page, 'АП. 001')
  await card.getByRole('button', { name: 'Добави' }).click()

  const item = selectedItem(page, 'АП. 001')
  await item.getByRole('button', { name: 'Премахни' }).click()

  await expect(item).toHaveCount(0)
  await expect(page.getByText('Няма избрани имоти. Добавете от списъка.')).toBeVisible()
  await expect(page.locator('.hero-metric').filter({ hasText: 'Избрани имоти' }).locator('.metric-value')).toHaveText('0')
  await expect(card.getByRole('button', { name: 'Добави' })).toBeEnabled()
})

test('tab navigation and entrance filtering show only matching parking units', async ({ page }) => {
  const pickerPanel = getPickerPanel(page)

  await pickerPanel.getByRole('button', { name: 'Паркоместа, гаражи и мазета' }).click()
  await expect(unitCard(page, 'ПМ 1-2')).toBeVisible()

  const entranceSelect = pickerPanel.locator('select')
  await entranceSelect.selectOption('В/Г')

  const visibleCards = pickerPanel.locator('.unit-card')
  const cardCount = await visibleCards.count()
  expect(cardCount).toBeGreaterThan(0)

  for (let i = 0; i < cardCount; i += 1) {
    const text = await visibleCards.nth(i).innerText()
    expect(
      text.includes('Вход В/Г') || text.includes('Вход В') || text.includes('Вход Г')
    ).toBeTruthy()
  }

  await expect(pickerPanel.locator('.unit-card').filter({ hasText: 'Вход А/Б' })).toHaveCount(0)
  await expect(pickerPanel.locator('.unit-card').filter({ hasText: 'Вход Д/Е' })).toHaveCount(0)
})

test('search respects active tab and filters correctly after tab switches', async ({ page }) => {
  const pickerPanel = getPickerPanel(page)
  const searchInput = pickerPanel.getByRole('textbox')

  await searchInput.fill('АП. 102')
  await expect(unitCard(page, 'АП. 102')).toBeVisible()
  await expect(pickerPanel.locator('.unit-card').filter({ hasText: 'ПМ ' })).toHaveCount(0)

  await pickerPanel.getByRole('button', { name: 'Паркоместа, гаражи и мазета' }).click()
  await expect(pickerPanel.locator('.unit-card')).toHaveCount(0)

  await searchInput.fill('ПМ 1-2')
  await expect(unitCard(page, 'ПМ 1-2')).toBeVisible()
  await expect(pickerPanel.locator('.unit-card').filter({ hasText: 'АП.' })).toHaveCount(0)

  await pickerPanel.getByRole('button', { name: 'Жилищни имоти' }).click()
  await expect(pickerPanel.locator('.unit-card')).toHaveCount(0)
})

test('guards against duplicate unit additions', async ({ page }) => {
  const card = unitCard(page, 'АП. 001')
  const addButton = card.getByRole('button', { name: 'Добави' })

  await addButton.dblclick()
  await expect(card.getByRole('button', { name: 'Добавено' })).toBeDisabled()

  await expect(getSelectedPanel(page).locator('.selected-item').filter({ hasText: 'АП. 001' })).toHaveCount(1)
  await expect(page.locator('.hero-metric').filter({ hasText: 'Избрани имоти' }).locator('.metric-value')).toHaveText('1')
})
