# Israel population by locality, 2023 — area selection map

A static map of every locality the Israeli CBS publishes 2023 population figures
for. Draw a **rectangle**, a freehand **lasso**, or a **polygon** on the map and
the panel reports the totals inside it: overall population, Jews & others
(יהודים ואחרים), Arabs (ערבים) and foreign residents (זרים), plus the list of
localities and a CSV of the selection.

The interface is available in **English and Hebrew** — pick one in the top
right; Hebrew switches the whole page to right-to-left. The choice is
remembered in the browser, and the first visit follows the browser's own
language.

A drawn shape stays editable — drag its corners to reshape it, drag the centre
to slide the whole thing somewhere else, and the totals follow as you drag.
Every view is a shareable link: **Copy link** puts the map position and the
shape into the URL, and opening that URL restores both.

Everything is static — HTML, CSS, two JS files and a vendored copy of Leaflet —
so GitHub Pages serves it as-is with no build step, and opening
`docs/index.html` straight off disk works too.

## Publishing on GitHub Pages

The site lives in `docs/`. In the repository, go to
**Settings → Pages → Build and deployment**, set *Source* to **Deploy from a
branch**, and pick your default branch with the **`/docs`** folder. Push, and the
map appears at `https://<user>.github.io/<repo>/`.

To serve it from the repository root instead, move the contents of `docs/` up one
level and choose **`/ (root)`** there.

Locally, just open `docs/index.html` in a browser — the data arrives as a
`<script>` (`data.js`), not a `fetch`, so there is nothing for the `file://`
origin rules to block. To serve it over http instead:

```sh
python3 -m http.server 8000 --directory docs
# then open http://localhost:8000/
```

## Rebuilding the data

`docs/data.json` is generated from the workbook. Re-run the build after dropping
in a newer CBS file:

```sh
pip install -r requirements.txt
python3 build_data.py
```

- `build_data.py` reads `bycode2023Sofi.xlsx`, looks the columns up **by Hebrew
  header name** (not position), and writes both `docs/data.js` (what the page
  loads) and `docs/data.json` (the same payload, for anything else that wants
  it).
- `itm.py` converts the workbook's `קואורדינטות` field — Israeli Transverse
  Mercator (EPSG:2039), easting and northing concatenated into one number — to
  WGS84 latitude/longitude, including the Israel 1993 → WGS84 datum shift. It is
  self-contained, so the build needs no PROJ/pyproj install. Run
  `python3 itm.py` to print its check points.

Of the 1,484 rows in the workbook, **1,221** carry a published 2023 population
and are mapped; 263 (mostly Bedouin tribes counted under another locality) have
no published figure and are dropped. The mapped total is 9,826,322, matching the
CBS national figure for 2023.

## How the numbers work

- Each locality is a single **point** — its CBS reference coordinate, not a
  boundary. A locality therefore counts **in full or not at all**, depending on
  whether its point falls inside the shape you drew. For city-scale questions
  that is exact; for a line drawn through a large city it is not.
- `total = (Jews & others) + Arabs + foreign residents`, exactly as CBS reports
  it; the three groups always sum to the total in this file.
- Circle **area** is proportional to population; circle **colour** is the
  locality's largest group.

## Layout

```
build_data.py          workbook -> docs/data.json
itm.py                 EPSG:2039 -> WGS84, no dependencies
bycode2023Sofi.xlsx    source workbook (CBS)
docs/
  index.html           page structure
  style.css            layout and the light/dark palette
  app.js               map, the three selection tools, totals, permalinks
  strings.js           every UI string, one block per language
  data.js              generated — loaded by the page
  data.json            generated — the same data, for other consumers
  vendor/leaflet/      Leaflet 1.9.4, vendored so the site has no CDN dependency
```

Basemap tiles come from Esri's gray canvas (no API key); the data itself is
served from your own Pages site.

## Adjusting a selection

Once a shape is on the map it carries handles:

- a **corner handle** on every vertex — drag to resize a rectangle or to pull a
  single corner of a traced outline. A freehand lasso keeps a handle per corner
  it was thinned to, usually 20–40 of them.
- a **centre handle** to move the whole shape without reshaping it, which is the
  quick way to ask "and what about the same-sized area just north of here?"

Totals, the composition bar and the URL all update as you drag. A rectangle will
not collapse to nothing, and the centre handle steps aside on a selection too
small to hold both, so the corners always stay grabbable.

## Sharing a view

**Copy link** writes the current map position and selection into the URL and
copies it. The URL stays in sync as you pan and draw, so the address bar is
always the link to what you are looking at — the button is a convenience, not a
requirement, and it falls back to selecting the text if the browser blocks
clipboard access (`file://` in Firefox, for instance).

The shape rides in the hash as delta-encoded varints at about metre precision:

```
#v=11/32.08130/34.78180&r=yx_-F-88pGwylMy5iP     rectangle: two corners
#v=9/32.70000/35.30000&p=uz2mGq0g-G16nB_tGppkB…  traced outline: the whole ring
```

A freehand lasso is thinned to its meaningful corners before it goes in, so even
a long trace stays a couple of hundred characters. A link with no shape in it
just opens the whole country; a mangled one degrades to the same rather than
failing.

## Adding a language

All UI text lives in `docs/strings.js`, one block per language. To add one:

1. Copy the `en` block, translate the values, and give it the language's code
   as its key. `dir` is `ltr` or `rtl`; `locale` is what `Intl.NumberFormat`
   uses to group digits.
2. Add a button to the `.lang` group in `index.html`:
   `<button type="button" data-lang="xx" lang="xx">Name</button>`.

Nothing else needs touching — the layout is written with logical properties
(`inset-inline-start`, `text-align: start`), so an RTL language mirrors on its
own. Locality names come from the CBS file itself and stay Hebrew plus
transliteration in every language, as do the CSV column headers, which are
meant to be machine-readable.

## Keyboard

| key | action |
|-----|--------|
| `R` / `L` / `P` | rectangle / lasso / polygon |
| `Enter` | close the polygon being drawn |
| `Esc` | cancel the drawing, then the tool, then the selection |

The keys work whenever the map has focus.

## Source

Israel Central Bureau of Statistics, **[יישובים בישראל / Localities in
Israel](https://www.cbs.gov.il/he/publications/Pages/2019/%D7%99%D7%99%D7%A9%D7%95%D7%91%D7%99%D7%9D-%D7%91%D7%99%D7%A9%D7%A8%D7%90%D7%9C.aspx)** — the *2023 final* file, downloaded as `bycode2023Sofi.xlsx`.
That page is where newer years appear; drop a later workbook in, point
`build_data.py` at it and rebuild.
