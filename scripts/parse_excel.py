from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_XLSX_PATH = ROOT / "docs" / "Площи - Премиум Естейт V2.xlsx"
OUTPUT_UNITS = ROOT / "src" / "data" / "units.json"
OUTPUT_OFFERS = ROOT / "src" / "data" / "offers.json"


def slugify(value: str, fallback: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")
    return value or fallback


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
            category = "residential"
            display_type = "Garage"
        elif unit_upper.startswith("ПМ"):
            unit_type = "parking"
            category = "parking"
            display_type = "Parking"
        elif re.match(r"^[MМ]\d", unit_label):
            # Storage rooms (мазе) are out of scope.
            continue
        else:
            continue

        if category == "parking":
            entrance = current_parking_group or "Parking"
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

        unit_id = f"{entrance}|{unit_label}"
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


def parse_offers(xlsx_path: Path) -> list[dict]:
    offers_df = pd.read_excel(xlsx_path, sheet_name="Оферти")
    base_columns = {"Категория", "Услуга", "Бележки"}
    offer_columns = [col for col in offers_df.columns if col not in base_columns]

    residential_row = offers_df[offers_df["Категория"] == "Такса на кв.м. жилищна част"]

    # The sheet labels this row either as "паркоместа" (parking spots) or (older versions) "гаражи".
    parking_row = offers_df[
        offers_df["Категория"].isin(["Такса на кв.м. паркоместа", "Такса на кв.м. гаражи"])
    ]

    if residential_row.empty or parking_row.empty:
        raise ValueError("Missing rate rows for residential or parking fees.")

    residential_row = residential_row.iloc[0]
    parking_row = parking_row.iloc[0]

    offers: list[dict] = []
    for idx, column in enumerate(offer_columns, start=1):
        res_value = residential_row.get(column)
        park_value = parking_row.get(column)

        if pd.isna(res_value) and pd.isna(park_value):
            continue

        offer_id = slugify(str(column), f"offer-{idx}")
        offers.append(
            {
                "id": offer_id,
                "name": str(column),
                "residentialRate": float(res_value) if pd.notna(res_value) else 0.0,
                "parkingRate": float(park_value) if pd.notna(park_value) else 0.0,
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
    offers = parse_offers(xlsx_path)

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
