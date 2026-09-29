#!/usr/bin/env python3
"""Turn the CBS 2023 locality workbook into the static JSON the map loads.

Reads bycode2023Sofi.xlsx, converts the ITM coordinate field to WGS84 and
writes docs/data.json. Re-run after replacing the workbook with a newer year.
"""
import json
import os
import sys

from openpyxl import load_workbook

from itm import itm_to_wgs84

# Source workbook: Israel CBS, "Localities in Israel", 2023 final file.
# https://www.cbs.gov.il/he/publications/Pages/2019/%D7%99%D7%99%D7%A9%D7%95%D7%91%D7%99%D7%9D-%D7%91%D7%99%D7%A9%D7%A8%D7%90%D7%9C.aspx
SRC = os.path.join(os.path.dirname(__file__), "bycode2023Sofi.xlsx")
DOCS = os.path.join(os.path.dirname(__file__), "docs")
OUT_JSON = os.path.join(DOCS, "data.json")
# The page loads data.js with a <script> tag rather than fetching the JSON, so
# that opening docs/index.html straight off disk works too — browsers refuse
# fetch() on file:// URLs.
OUT_JS = os.path.join(DOCS, "data.js")

# Column headers we need, as they appear in the workbook's first row.
COLS = {
    "name_he": "שם יישוב",
    "code": "סמל יישוב",
    "name_en": "שם יישוב באנגלית",
    "district": "שם מחוז",
    "subdistrict": "שם נפה",
    "municipal": "שם מעמד מונציפאלי",
    "total": "סך הכל אוכלוסייה 2023 (סופי)",
    "israelis": "סך הכל ישראלים 2023 (סופי)",
    "jews": "יהודים ואחרים",
    "arabs": "ערבים",
    "foreign": "זרים",
    "coord": "קואורדינטות",
}


def num(value):
    """Blank cells mean 'not published' in this file; treat them as zero."""
    if value is None or value == "":
        return 0
    return int(float(str(value).replace(",", "").strip()))


def text(value):
    return "" if value is None else str(value).strip()


def parse_coord(raw):
    """The coordinate field is easting+northing concatenated, no separator.

    12 digits are metres (6+6); 10 digits are tens of metres (5+5). Rows with
    anything else have no usable location.
    """
    s = text(raw)
    if not s.isdigit():
        return None
    if len(s) == 12:
        return int(s[:6]), int(s[6:])
    if len(s) == 10:
        return int(s[:5]) * 10, int(s[5:]) * 10
    return None


def main():
    ws = load_workbook(SRC, data_only=True, read_only=True).worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = [text(c) for c in next(rows)]
    try:
        idx = {key: header.index(title) for key, title in COLS.items()}
    except ValueError as exc:
        sys.exit(f"unexpected workbook layout: {exc}")

    places, skipped_coord, skipped_pop = [], [], 0
    for row in rows:
        name_he = text(row[idx["name_he"]])
        if not name_he:
            continue
        total = num(row[idx["total"]])
        if total == 0:
            skipped_pop += 1
            continue
        coord = parse_coord(row[idx["coord"]])
        if coord is None:
            skipped_coord.append(name_he)
            continue
        lat, lon = itm_to_wgs84(*coord)
        jews = num(row[idx["jews"]])
        arabs = num(row[idx["arabs"]])
        foreign = num(row[idx["foreign"]])
        places.append([
            round(lat, 5),
            round(lon, 5),
            total,
            jews,
            arabs,
            foreign,
            name_he,
            text(row[idx["name_en"]]),
            text(row[idx["code"]]),
            text(row[idx["district"]]),
            text(row[idx["subdistrict"]]),
        ])

    places.sort(key=lambda p: -p[2])
    data = {
        "year": 2023,
        "source": "Israel CBS, list of localities 2023 (final)",
        "source_url": "https://www.cbs.gov.il/he/publications/Pages/2019/%D7%99%D7%99%D7%A9%D7%95%D7%91%D7%99%D7%9D-%D7%91%D7%99%D7%A9%D7%A8%D7%90%D7%9C.aspx",
        "fields": ["lat", "lon", "total", "jews", "arabs", "foreign",
                   "name_he", "name_en", "code", "district", "subdistrict"],
        "places": places,
    }
    os.makedirs(DOCS, exist_ok=True)
    blob = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    with open(OUT_JSON, "w", encoding="utf-8") as fh:
        fh.write(blob)
    with open(OUT_JS, "w", encoding="utf-8") as fh:
        fh.write("window.POPULATION_DATA = " + blob + ";\n")

    total = sum(p[2] for p in places)
    print(f"{len(places)} localities -> {OUT_JSON} and {OUT_JS} "
          f"({os.path.getsize(OUT_JS)/1024:.0f} kB)")
    print(f"population {total:,} | jews+others {sum(p[3] for p in places):,} "
          f"| arabs {sum(p[4] for p in places):,} | foreign {sum(p[5] for p in places):,}")
    print(f"skipped: {skipped_pop} without published population, "
          f"{len(skipped_coord)} without coordinates {skipped_coord or ''}")


if __name__ == "__main__":
    main()
