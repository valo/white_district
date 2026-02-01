import { useMemo, useState } from 'react'
import unitsData from './data/units.json'
import offersData from './data/offers.json'
import './App.css'

function App() {
  const [lang, setLang] = useState('en')
  const [tab, setTab] = useState('residential')
  const [search, setSearch] = useState('')
  const [entranceFilter, setEntranceFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])

  const units = unitsData.units
  const offers = offersData.offers

  const entranceOrderMap = useMemo(
    () => ({
      A: 0,
      А: 0,
      B: 1,
      Б: 1,
      В: 2,
      V: 2,
      Г: 3,
      G: 3,
      Д: 4,
      D: 4,
      E: 5,
      Е: 5,
    }),
    []
  )

  const getEntranceRank = (value) => {
    const [first, second] = String(value).split('/')
    const rankFor = (part) => {
      const letter = part.trim().charAt(0).toUpperCase()
      return entranceOrderMap[letter] ?? 999
    }
    return [rankFor(first), second ? rankFor(second) : 999, value]
  }

  const copy = useMemo(
    () => ({
      en: {
        eyebrow: 'White District',
        title: 'Monthly Maintenance Fee Calculator',
        intro:
          'Select apartments and parking spots to see monthly fees per offer, VAT, and totals. Fees include common areas. Garages and ateliers are counted as residential units.',
        selectedUnits: 'Selected units',
        residentialArea: 'Residential area (incl. common)',
        parkingArea: 'Parking area (incl. common)',
        baseAreaLabel: 'Base area',
        commonAreaLabel: 'Common area',
        totalAreaLabel: 'Total area',
        unitPicker: 'Unit picker',
        unitPickerSubtitle: 'Add apartments, ateliers, garages, or parking spots.',
        residentialTab: 'Residential units',
        parkingTab: 'Parking spots',
        searchLabel: 'Search',
        searchPlaceholder: 'e.g., АП. 101, ПМ 1-2',
        entranceLabel: 'Entrance',
        entranceAll: 'All',
        add: 'Add',
        added: 'Added',
        remove: 'Remove',
        selectedSubtitle: 'Review your selection before calculating fees.',
        emptyState: 'No units selected yet. Add units from the picker.',
        feesTitle: 'Monthly fees by offer',
        vatRate: 'VAT rate: 20%',
        offer: 'Offer',
        residentialRate: 'Residential rate',
        parkingRate: 'Parking rate',
        monthlyExVat: 'Monthly fee (excl. VAT)',
        vat: 'VAT (20%)',
        totalVat: 'Total incl. VAT',
        currentTax: 'Current monthly tax (incl. VAT)',
        taxRateNote:
          'Tax rate: 0.60 €/m² residential, 0.31 €/m² parking + 20% VAT (incl. common areas)',
        languageLabel: 'Language',
        switchTo: 'Български',
      },
      bg: {
        eyebrow: 'White District',
        title: 'Калкулатор за месечна такса поддръжка',
        intro:
          'Изберете апартаменти и паркоместа, за да видите месечните такси по оферти, ДДС и общи суми. Таксите включват общи части. Гаражите и ателиетата се считат за жилищни площи.',
        selectedUnits: 'Избрани имоти',
        residentialArea: 'Жилищна площ (с общи части)',
        parkingArea: 'Паркинг площ (с общи части)',
        baseAreaLabel: 'Чиста площ',
        commonAreaLabel: 'Общи части',
        totalAreaLabel: 'Обща площ',
        unitPicker: 'Избор на имоти',
        unitPickerSubtitle:
          'Добавете апартаменти, ателиета, гаражи или паркоместа.',
        residentialTab: 'Жилищни имоти',
        parkingTab: 'Паркоместа',
        searchLabel: 'Търсене',
        searchPlaceholder: 'напр. АП. 101, ПМ 1-2',
        entranceLabel: 'Вход',
        entranceAll: 'Всички',
        add: 'Добави',
        added: 'Добавено',
        remove: 'Премахни',
        selectedSubtitle:
          'Прегледайте избора си преди изчисляване на таксите.',
        emptyState: 'Няма избрани имоти. Добавете от списъка.',
        feesTitle: 'Месечни такси по оферти',
        vatRate: 'ДДС: 20%',
        offer: 'Оферта',
        residentialRate: 'Жилищна ставка',
        parkingRate: 'Паркинг ставка',
        monthlyExVat: 'Месечна такса (без ДДС)',
        vat: 'ДДС (20%)',
        totalVat: 'Общо с ДДС',
        currentTax: 'Текуща месечна такса (с ДДС)',
        taxRateNote:
          'Ставка: 0.60 €/м² жилищна част, 0.31 €/м² паркинг + 20% ДДС (с общи части)',
        languageLabel: 'Език',
        switchTo: 'English',
      },
    }),
    []
  )

  const text = copy[lang]
  const nextLanguage = lang === 'en' ? 'bg' : 'en'
  const nextLabel = copy[nextLanguage].switchTo
  const nextFlagClass = nextLanguage === 'bg' ? 'flag-bg' : 'flag-gb'

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const entrances = useMemo(() => {
    const values = units
      .filter((unit) => unit.category === tab)
      .map((unit) => unit.entrance)
    return Array.from(new Set(values)).sort((a, b) => {
      const [rankA, secondaryA, valueA] = getEntranceRank(a)
      const [rankB, secondaryB, valueB] = getEntranceRank(b)
      if (rankA !== rankB) return rankA - rankB
      if (secondaryA !== secondaryB) return secondaryA - secondaryB
      return String(valueA).localeCompare(String(valueB), 'bg', {
        numeric: true,
      })
    })
  }, [tab, units, entranceOrderMap])

  const filteredUnits = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return units
      .filter((unit) => unit.category === tab)
      .filter((unit) =>
        entranceFilter === 'all' ? true : unit.entrance === entranceFilter
      )
      .filter((unit) =>
        normalizedSearch.length === 0
          ? true
          : unit.label.toLowerCase().includes(normalizedSearch)
      )
      .sort(
        (a, b) =>
          a.entrance.localeCompare(b.entrance, 'bg', { numeric: true }) ||
          a.label.localeCompare(b.label, 'bg', { numeric: true })
      )
  }, [tab, units, entranceFilter, search])

  const selectedUnits = useMemo(
    () => units.filter((unit) => selectedSet.has(unit.id)),
    [units, selectedSet]
  )

  const totals = useMemo(() => {
    return selectedUnits.reduce(
      (acc, unit) => {
        const baseArea = unit.area ?? 0
        const commonArea = unit.commonArea ?? 0
        const totalArea = unit.totalArea ?? baseArea + commonArea

        if (unit.category === 'residential') {
          acc.residentialBase += baseArea
          acc.residentialCommon += commonArea
          acc.residentialTotal += totalArea
        } else {
          acc.parkingBase += baseArea
          acc.parkingCommon += commonArea
          acc.parkingTotal += totalArea
        }
        acc.count += 1
        return acc
      },
      {
        residentialBase: 0,
        residentialCommon: 0,
        residentialTotal: 0,
        parkingBase: 0,
        parkingCommon: 0,
        parkingTotal: 0,
        count: 0,
      }
    )
  }, [selectedUnits])

  const VAT_RATE = 0.2
  const TAX_RESIDENTIAL = 0.6
  const TAX_PARKING = 0.31

  const offerRows = useMemo(() => {
    return offers.map((offer) => {
      const monthly =
        totals.residentialTotal * offer.residentialRate +
        totals.parkingTotal * offer.parkingRate
      const vat = monthly * VAT_RATE
      const total = monthly + vat
      return { ...offer, monthly, vat, total }
    })
  }, [offers, totals])

  const currentTax = useMemo(() => {
    const base =
      totals.residentialTotal * TAX_RESIDENTIAL +
      totals.parkingTotal * TAX_PARKING
    const vat = base * VAT_RATE
    return base + vat
  }, [totals])

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('bg-BG', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  )

  const areaFormatter = useMemo(
    () =>
      new Intl.NumberFormat('bg-BG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  )

  const rateFormatter = useMemo(
    () =>
      new Intl.NumberFormat('bg-BG', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }),
    []
  )

  const handleAdd = (unitId) => {
    if (selectedSet.has(unitId)) return
    setSelectedIds((prev) => [...prev, unitId])
  }

  const handleRemove = (unitId) => {
    setSelectedIds((prev) => prev.filter((id) => id !== unitId))
  }

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'en' ? 'bg' : 'en'))
  }

  const displayType = (unit) => {
    if (lang !== 'bg') return unit.displayType
    switch (unit.type) {
      case 'apartment':
        return 'Апартамент'
      case 'atelier':
        return 'Ателие'
      case 'garage':
        return 'Гараж'
      case 'parking':
        return 'Паркомясто'
      default:
        return unit.displayType
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-text">
          <span className="eyebrow">{text.eyebrow}</span>
          <h1>{text.title}</h1>
          <p>{text.intro}</p>
        </div>
        <div className="hero-card">
          <div className="hero-actions">
            <span>{text.languageLabel}</span>
            <button className="ghost" type="button" onClick={toggleLanguage}>
              <span className="flag" aria-hidden="true">
                <span className={`flag-icon ${nextFlagClass}`} />
              </span>
              {nextLabel}
            </button>
          </div>
          <div className="hero-metric">
            <span className="metric-label">{text.selectedUnits}</span>
            <span className="metric-value">{totals.count}</span>
          </div>
          <div className="hero-metric">
            <span className="metric-label">{text.residentialArea}</span>
            <span className="metric-value">
              {areaFormatter.format(totals.residentialTotal)} m²
            </span>
          </div>
          <div className="hero-metric">
            <span className="metric-label">{text.parkingArea}</span>
            <span className="metric-value">
              {areaFormatter.format(totals.parkingTotal)} m²
            </span>
          </div>
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <div className="panel-header">
            <h2>{text.unitPicker}</h2>
            <span className="panel-subtitle">{text.unitPickerSubtitle}</span>
          </div>

          <div className="tabs">
            <button
              className={tab === 'residential' ? 'tab active' : 'tab'}
              onClick={() => {
                setTab('residential')
                setEntranceFilter('all')
              }}
              type="button"
            >
              {text.residentialTab}
            </button>
            <button
              className={tab === 'parking' ? 'tab active' : 'tab'}
              onClick={() => {
                setTab('parking')
                setEntranceFilter('all')
              }}
              type="button"
            >
              {text.parkingTab}
            </button>
          </div>

          <div className="filters">
            <label className="field">
              <span>{text.searchLabel}</span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={text.searchPlaceholder}
              />
            </label>
            <label className="field">
              <span>{text.entranceLabel}</span>
              <select
                value={entranceFilter}
                onChange={(event) => setEntranceFilter(event.target.value)}
              >
                <option value="all">{text.entranceAll}</option>
                {entrances.map((entrance) => (
                  <option key={entrance} value={entrance}>
                    {entrance}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="unit-list">
            {filteredUnits.map((unit) => {
              const isSelected = selectedSet.has(unit.id)
              return (
                <div className="unit-card" key={unit.id}>
                  <div>
                    <div className="unit-title">{unit.label}</div>
                    <div className="unit-meta">
                      <span>{displayType(unit)}</span>
                      <span>
                        {text.entranceLabel} {unit.entrance}
                      </span>
                      <span>
                        {text.baseAreaLabel} {areaFormatter.format(unit.area)} m²
                      </span>
                      <span>
                        {text.commonAreaLabel}{' '}
                        {areaFormatter.format(unit.commonArea ?? 0)} m²
                      </span>
                      <span>
                        {text.totalAreaLabel}{' '}
                        {areaFormatter.format(
                          unit.totalArea ?? unit.area + (unit.commonArea ?? 0)
                        )}{' '}
                        m²
                      </span>
                    </div>
                  </div>
                  <button
                    className={isSelected ? 'ghost disabled' : 'primary'}
                    onClick={() => handleAdd(unit.id)}
                    type="button"
                    disabled={isSelected}
                  >
                    {isSelected ? text.added : text.add}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>{text.selectedUnits}</h2>
            <span className="panel-subtitle">{text.selectedSubtitle}</span>
          </div>

          <div className="selected-summary">
            <div>
              <span>{text.residentialArea}</span>
              <strong>{areaFormatter.format(totals.residentialTotal)} m²</strong>
            </div>
            <div>
              <span>{text.parkingArea}</span>
              <strong>{areaFormatter.format(totals.parkingTotal)} m²</strong>
            </div>
            <div>
              <span>{text.currentTax}</span>
              <strong>{currencyFormatter.format(currentTax)}</strong>
            </div>
          </div>
          <div className="note">{text.taxRateNote}</div>

          <div className="selected-list">
            {selectedUnits.length === 0 ? (
              <div className="empty-state">
                {text.emptyState}
              </div>
            ) : (
              selectedUnits.map((unit) => (
                <div className="selected-item" key={unit.id}>
                  <div>
                    <div className="unit-title">{unit.label}</div>
                    <div className="unit-meta">
                      <span>{displayType(unit)}</span>
                      <span>
                        {text.entranceLabel} {unit.entrance}
                      </span>
                      <span>
                        {text.baseAreaLabel} {areaFormatter.format(unit.area)} m²
                      </span>
                      <span>
                        {text.commonAreaLabel}{' '}
                        {areaFormatter.format(unit.commonArea ?? 0)} m²
                      </span>
                      <span>
                        {text.totalAreaLabel}{' '}
                        {areaFormatter.format(
                          unit.totalArea ?? unit.area + (unit.commonArea ?? 0)
                        )}{' '}
                        m²
                      </span>
                    </div>
                  </div>
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => handleRemove(unit.id)}
                  >
                    {text.remove}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel wide">
          <div className="panel-header">
            <h2>{text.feesTitle}</h2>
            <span className="panel-subtitle">{text.vatRate}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{text.offer}</th>
                  <th>{text.residentialRate}</th>
                  <th>{text.parkingRate}</th>
                  <th>{text.monthlyExVat}</th>
                  <th>{text.vat}</th>
                  <th>{text.totalVat}</th>
                </tr>
              </thead>
              <tbody>
                {offerRows.map((offer) => (
                  <tr key={offer.id}>
                    <td>{offer.name}</td>
                    <td>{rateFormatter.format(offer.residentialRate)} €/m²</td>
                    <td>{rateFormatter.format(offer.parkingRate)} €/m²</td>
                    <td>{currencyFormatter.format(offer.monthly)}</td>
                    <td>{currencyFormatter.format(offer.vat)}</td>
                    <td>{currencyFormatter.format(offer.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
