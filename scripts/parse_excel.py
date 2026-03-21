from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_XLSX_PATH = ROOT / "docs" / "Площи - Премиум Естейт V2.5.xlsx"
OUTPUT_UNITS = ROOT / "src" / "data" / "units.json"
OUTPUT_OFFERS = ROOT / "src" / "data" / "offers.json"


def slugify(value: str, fallback: str) -> str:
    value = value.strip().casefold()
    value = re.sub(r"[^\w]+", "-", value, flags=re.UNICODE)
    value = value.strip("-_")
    return value or fallback


def unique_slugify(value: str, fallback: str, used_ids: set[str]) -> str:
    base = slugify(value, fallback)
    candidate = base
    suffix = 2
    while candidate in used_ids:
        candidate = f"{base}-{suffix}"
        suffix += 1
    used_ids.add(candidate)
    return candidate


def find_header_index(raw: pd.DataFrame, needle: str) -> int:
    for idx, row in raw.iterrows():
        if row.astype(str).str.contains(needle, na=False).any():
            return idx
    raise ValueError(f"Could not find header row containing '{needle}'")


def round2(value: float) -> float:
    return round(float(value) + 1e-9, 2)


def find_column_index(header_row: list, predicate) -> int:
    for idx, value in enumerate(header_row):
        if predicate(str(value)):
            return idx
    raise ValueError("Required column not found in header row.")


def is_residential_fee_unit(unit: dict) -> bool:
    return unit["type"] in {"apartment", "atelier", "storage"}


def calculate_area_totals(units: list[dict]) -> dict[str, float]:
    totals = {"residential": 0.0, "parking": 0.0}
    for unit in units:
        total_area = float(unit.get("totalArea") or (unit["area"] + unit.get("commonArea", 0)))
        if is_residential_fee_unit(unit):
            totals["residential"] += total_area
        else:
            totals["parking"] += total_area
    return totals


def parse_units(xlsx_path: Path) -> list[dict]:
    raw = pd.read_excel(xlsx_path, sheet_name="Жилищна част", header=None)
    header_idx = find_header_index(raw, "АП. №")
    header_row = [str(value) for value in raw.loc[header_idx].tolist()]

    unit_col = find_column_index(header_row, lambda v: "АП. №" in v)
    area_col = find_column_index(header_row, lambda v: "F1/M2" in v)
    common_col = find_column_index(header_row, lambda v: "К И.Ч" in v and "М2" in v)
    total_col = find_column_index(header_row, lambda v: "F1" in v and "К И.Ч" in v)

    units: list[dict] = []
    current_entrance: str | None = None
    current_parking_group: str | None = None

    for idx, row in raw.iterrows():
        if idx <= header_idx:
            continue

        first_cell = row[0]
        if isinstance(first_cell, str):
            # Parking group sections are defined by "ПОДОБЕКТ" rows.
            if "ПОДОБЕКТ" in first_cell and "ВХОД" in first_cell:
                letters = re.findall(r"ВХОД\s+\"?([A-Za-zА-Яа-я])\"?", first_cell)
                if letters:
                    unique_letters = []
                    for letter in letters:
                        if letter not in unique_letters:
                            unique_letters.append(letter)
                    current_parking_group = "/".join(unique_letters[:2] or unique_letters)
                continue

            # Entrance rows look like: ВХОД "A"
            if "ВХОД" in first_cell and "ПОДОБЕКТ" not in first_cell and "ОБЩА ПЛОЩ" not in first_cell:
                letters = re.findall(r"ВХОД\s+\"?([A-Za-zА-Яа-я])\"?", first_cell)
                if letters:
                    current_entrance = letters[0]
                continue

        unit = row[unit_col]
        area = row[area_col]
        if pd.isna(unit) or pd.isna(area):
            continue

        unit_label = str(unit).strip()
        if not unit_label or unit_label.lower() == "nan":
            continue

        try:
            area_value = round2(area)
        except (TypeError, ValueError):
            continue

        unit_upper = unit_label.upper()
        if unit_upper.startswith("АП"):
            unit_type = "apartment"
            category = "residential"
            display_type = "Apartment"
        elif unit_upper.startswith("АТ"):
            unit_type = "atelier"
            category = "residential"
            display_type = "Atelier"
        elif unit_upper.startswith("ГАР"):
            unit_type = "garage"
            category = "parking"
            display_type = "Garage"
        elif unit_upper.startswith("ПМ"):
            unit_type = "parking"
            category = "parking"
            display_type = "Parking"
        elif re.match(r"^[MМ]\d", unit_label):
            unit_type = "storage"
            # Storage units ("Мазе") are billed with residential rates.
            category = "residential"
            display_type = "Storage"
        else:
            continue

        if unit_type == "storage":
            entrance = current_entrance or "?"
            if entrance in {"A", "А", "B", "Б"}:
                entrance = "А/Б"
            elif entrance in {"V", "В", "G", "Г"}:
                entrance = "В/Г"
            elif entrance in {"D", "Д", "E", "Е"}:
                entrance = "Д/Е"
        elif unit_type == "parking":
            entrance = current_parking_group or "Parking"
        elif unit_type == "garage":
            # Garages are billed with parking rates, but should keep their real entrance label.
            entrance = current_entrance or "?"
        else:
            entrance = current_entrance or "?"

        common_value = row[common_col] if common_col is not None else None
        total_value = row[total_col] if total_col is not None else None

        try:
            common_area = round2(common_value) if pd.notna(common_value) else 0.0
        except (TypeError, ValueError):
            common_area = 0.0

        try:
            total_area = round2(total_value) if pd.notna(total_value) else round2(area_value + common_area)
        except (TypeError, ValueError):
            total_area = round2(area_value + common_area)

        # Ensure unique, stable IDs even when labels repeat (e.g. multiple "ГАРАЖ 3").
        unit_id = f"{entrance}|{unit_label}|r{idx + 1}"
        units.append(
            {
                "id": unit_id,
                "entrance": entrance,
                "label": unit_label,
                "type": unit_type,
                "category": category,
                "area": area_value,
                "commonArea": common_area,
                "totalArea": total_area,
                "displayType": display_type,
            }
        )

    return units


def parse_offers(xlsx_path: Path, area_totals: dict[str, float]) -> list[dict]:
    offers_df = pd.read_excel(xlsx_path, sheet_name="Оферти")
    base_columns = {"Категория", "Услуга", "Бележки"}
    offer_columns = [col for col in offers_df.columns if col not in base_columns]

    category_series = offers_df["Категория"].fillna("").astype(str).str.strip()
    service_series = offers_df["Услуга"].fillna("").astype(str).str.strip()

    residential_row = offers_df[category_series == "Такса на кв.м. жилищна част"]

    # The sheet labels this row either as "паркоместа" (parking spots) or (older versions) "гаражи".
    parking_row = offers_df[
        category_series.isin(["Такса на кв.м. паркоместа", "Такса на кв.м. гаражи"])
    ]

    repair_residential_row = offers_df[
        (category_series == "Фонд ремонти")
        & service_series.str.contains("Жилищна част", case=False, regex=False)
    ]
    repair_parking_row = offers_df[
        (category_series == "Фонд ремонти")
        & service_series.str.contains("Сутерен", case=False, regex=False)
    ]

    if residential_row.empty or parking_row.empty or repair_residential_row.empty or repair_parking_row.empty:
        raise ValueError("Missing rate rows for residential, parking, or repair fund fees.")

    residential_row = residential_row.iloc[0]
    parking_row = parking_row.iloc[0]
    repair_residential_row = repair_residential_row.iloc[0]
    repair_parking_row = repair_parking_row.iloc[0]

    residential_area_total = area_totals["residential"]
    parking_area_total = area_totals["parking"]

    if residential_area_total <= 0 or parking_area_total <= 0:
        raise ValueError("Area totals must be positive in order to apportion repair fund fees.")

    offers: list[dict] = []
    used_ids: set[str] = set()
    for idx, column in enumerate(offer_columns, start=1):
        res_value = residential_row.get(column)
        park_value = parking_row.get(column)
        repair_residential_value = repair_residential_row.get(column)
        repair_parking_value = repair_parking_row.get(column)

        if pd.isna(res_value) and pd.isna(park_value):
            continue

        offer_id = unique_slugify(str(column), f"offer-{idx}", used_ids)
        offers.append(
            {
                "id": offer_id,
                "name": str(column),
                "residentialRate": float(res_value) if pd.notna(res_value) else 0.0,
                "parkingRate": float(park_value) if pd.notna(park_value) else 0.0,
                "repairFundResidentialRate": (
                    float(repair_residential_value) / residential_area_total
                    if pd.notna(repair_residential_value)
                    else 0.0
                ),
                "repairFundParkingRate": (
                    float(repair_parking_value) / parking_area_total
                    if pd.notna(repair_parking_value)
                    else 0.0
                ),
            }
        )

    return offers


def main(argv: list[str] | None = None) -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Regenerate units.json and offers.json from the White District XLSX")
    parser.add_argument(
        "--xlsx",
        type=Path,
        default=DEFAULT_XLSX_PATH,
        help=f"Path to XLSX (default: {DEFAULT_XLSX_PATH})",
    )
    args = parser.parse_args(argv)

    xlsx_path: Path = args.xlsx
    units = parse_units(xlsx_path)
    area_totals = calculate_area_totals(units)
    offers = parse_offers(xlsx_path, area_totals)

    OUTPUT_UNITS.write_text(
        json.dumps({"units": units}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    OUTPUT_OFFERS.write_text(
        json.dumps({"offers": offers}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {len(units)} units to {OUTPUT_UNITS}")
    print(f"Wrote {len(offers)} offers to {OUTPUT_OFFERS}")


if __name__ == "__main__":
    main()
