# White District Fee Calculator

Static React site for calculating monthly maintenance fees by offer, based on apartment and parking areas.

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
