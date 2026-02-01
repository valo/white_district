# White District Fee Calculator - Spec

## Goal
Create a static React website that lets users calculate monthly maintenance fees for a building based on selected apartments and parking spots. The fee depends on the size (m2) of the selected units and varies per offer.

## Data Sources
Excel file: `docs/Площи - Премиум Естейт V2.xlsx`

Sheets:
- `Жилищна част`: unit inventory and areas (m2)
- `Оферти`: offers and per-square-meter fees

## Unit Inventory (from `Жилищна част`)
Use the header row with these columns (exact names from the sheet):
- `ЕТ.`, `К. `, `АП. №`, `ОПИСАНИЕ`, `F1/M2/`, `К И.Ч./%/`

Extraction rules:
1) Use rows where `АП. №` contains a unit label and `F1/M2/` is a number (area in m2).
2) Track the current entrance (`ВХОД "A"`, `ВХОД "Б"`, `ВХОД "В"`, `ВХОД "Г"`, `ВХОД "Д"`, `ВХОД "E"`) and attach it to each unit for uniqueness.
3) Classify by `АП. №` prefix:
   - Apartments: `АП.` (e.g., `АП. 001`)
   - Ateliers: `АТ.` (treated as apartments)
   - Garages: `ГАРАЖ` / typo `ГАРЕАЖ` (treated as apartments / residential)
   - Parking spots: `ПМ` (e.g., `ПМ 1-2`, `ПМ 15`)
   - Storage rooms like `M1`, `M2`, ... are `мазе` and must be ignored.
4) Double parking labels like `ПМ 1-2` are a single selectable item using the listed area (do not split).

Expected counts (for import validation):
- Apartments (`АП.`): 127
- Ateliers (`АТ.`): 29
- Garages (`ГАРАЖ` / `ГАРЕАЖ`): 17
- Parking spots (`ПМ`): 76
- Storage rooms (`M...`): ignored

## Offers and Rates (from `Оферти`)
Offers are the columns:
- `Стопанка V1 (24/7 портиер)`
- `Стопанка V2 (8ч портиер)`
- `Стопанка V3 (без портиер)`
- `FM Solutions (осреднено 12 м.)`

Use the rows:
- `Такса на кв.м. жилищна част`
- `Такса на кв.м. гаражи`

Per-square-meter monthly rates (EUR/m2):
- Residential (жилищна част):
  - V1: 0.6251889798
  - V2: 0.4773538626
  - V3: 0.3863787732
  - FM: 0.6771187569
- Parking/Garage rate (гаражи):
  - V1: 0.1938995079
  - V2: 0.1938995079
  - V3: 0.1938995079
  - FM: 0.2360262619

## Fee Calculation
User selects units (apartments + parking).

Definitions:
- Each unit has base area (from `Жилищна част`) and common area (идеални части).
- Total area per unit = base area + common area.
- Residential area sum = sum of total areas for all selected `АП.`, `АТ.`, and `ГАРАЖ` units.
- Parking area sum = sum of total areas for all selected `ПМ` units.

For each offer:
```
monthly_fee = (residential_area_sum * residential_rate) +
              (parking_area_sum * parking_rate)
```

Notes:
- Garages are part of the residential area (per user requirement).
- Storage rooms are ignored entirely.
- VAT is 20% and must be added to show a total including VAT.
- Common areas are included in all fee calculations.

## Common Area (Идеални части) Data
Source:
- `docs/Площи - Премиум Естейт V2.xlsx` → sheet `Жилищна част`

Columns:
- Base area: `F1/M2/`
- Common area: `К И.Ч. /М2/`
- Total area: `F1 + К И.Ч.`

Rules:
- If two units have the same base area, they must have the same common area.
- Common areas are taken directly from the updated V2 sheet.

## UI/UX Requirements
Front page sections:
1) Unit picker
   - Two tabs or dropdowns: Apartments and Parking
   - Search or filter by entrance and unit label
   - Add button to include unit in the selection set
2) Selected units list
   - Show: entrance, unit label, type (Apartment/Atelier/Garage/Parking), base area, common area, total area
   - Remove action per item
   - Display running totals: residential area (incl. common), parking area (incl. common)
3) Offer results table
   - One row per offer (V1, V2, V3, FM)
   - Columns: residential rate, parking rate, monthly fee (excl. VAT), VAT (20%), total incl. VAT
   - Display currency as EUR/month (format to 2 decimals)

Behavior:
- When no units are selected, all totals and fees are 0.00.
- Duplicate unit numbers across entrances must be distinct.

## Data Model (suggested JSON)
Units:
```
{
  id: "A|АП. 001",
  entrance: "A",
  label: "АП. 001",
  type: "apartment", // apartment | atelier | garage | parking
  area: 100.16
}
```

Offers:
```
{
  id: "stopanka-v1",
  name: "Стопанка V1 (24/7 портиер)",
  residentialRate: 0.6251889798,
  parkingRate: 0.1938995079
}
```

## Out of Scope
- Storage rooms (`мазе`) and any fees related to them.
- Any backend or dynamic server logic (static site only).
