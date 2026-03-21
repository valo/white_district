# White District Fee Calculator

Static React site for calculating monthly maintenance fees by offer, based on apartment and parking areas.

The fee table shows:
- taxable maintenance fee
- VAT on the taxable maintenance fee
- separate repair fund (`Фонд Ремонти` / `Repair Fund`) without VAT

## Requirements
- pnpm (this repo uses `pnpm@10.18.2` via `packageManager`)

## Install
```bash
pnpm install
```

## Development
```bash
pnpm dev
```

## Build
```bash
pnpm build
```

## Preview
```bash
pnpm preview
```

## Data refresh
If the Excel file is updated, regenerate the JSON data:
```bash
pnpm exec python3 scripts/parse_excel.py
```

By default, the parser reads `docs/Площи - Премиум Естейт V2.6.xlsx`.

To parse a different workbook explicitly:
```bash
pnpm exec python3 scripts/parse_excel.py --xlsx /path/to/workbook.xlsx
```
