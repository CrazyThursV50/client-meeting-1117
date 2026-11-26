# Federal FOIA Dashboard

A dashboard of the federal agencies' annual FOIA reports, FY2008–FY2025, built by a BU Spark! student team (DS 701,
fall 2026) for MuckRock. This repository holds everything needed to rebuild it: the data, the scripts that make the
data, the page, and the analysis notebooks.

**Live page:** https://crazythursv50.github.io/client-meeting-1117/ (branch `main`, served from `docs/`)

All numbers come from the agencies' annual FOIA reports on foia.gov. The top bar shows the day the data was last
refreshed.

## What is on the page

- **Start page.** Ten cards, one or more for each of the six questions: requests received, backlogged requests,
  backlog ÷ requests received, appeals received, FOIA staff, released in full, closed with no records reviewed,
  exemptions applied, done within 20 working days, total cost. Each gives the number for the last year chosen, the
  change from the year before, and a small chart that marks the first and last year chosen (the first value at the
  left, the change since then at the right: "×2.6" for a count, points for a share). The "i" says in one sentence
  what the number is; hovering over a card shows what stands out in the years chosen; clicking it opens a larger
  chart with those points marked and a link to its question. What a card says is worked out from the data each
  time, so it follows the choices and the next refresh. Three cards are shaded to stand out (backlog, exemptions
  applied, released in full), as the client suggested at the Nov. 17 meeting. A few lines above the cards say what the dashboard is.
- **Questions 1–6** (the project's guiding questions, in the sidebar). Each page opens with up to three numbers,
  each with how it is worked out, then a chart over time and a chart by agency; question 4 adds the exemptions used,
  folded until opened. "Built from" (folded) lists the report tables and columns the page uses. In a chart by
  agency, clicking a row opens that agency or component.
- **Choices that apply everywhere**: agency and component, up to five entries to compare (agencies with each other;
  a component only within its own agency), the fiscal years (presets or a two-handled slider), and which agencies
  are added up in the government total (all that reported, or only the agencies that reported every year). "Reset"
  puts them back; "Copy link to this view" copies an address that opens the same view.
- **Colours**: a measure has one colour on every page (requests received blue, processed red, backlog purple, FOIA
  staff navy, total cost green); gold marks the agency or component open in a chart by agency. All colours are from
  MuckRock's data-visualization palette.
- **How to use this dashboard** (sidebar) opens the user guide, with the rules used everywhere.
- **Analysis notebooks** (not linked from the page), the checked analysis behind the project:
  [Requests](https://crazythursv50.github.io/client-meeting-1117/notebooks/S0-request-volume-en.html) ·
  [Outcomes](https://crazythursv50.github.io/client-meeting-1117/notebooks/S1-partial-releases-en.html) ·
  [Appeals](https://crazythursv50.github.io/client-meeting-1117/notebooks/S3-appeals-en.html) ·
  [Backlog](https://crazythursv50.github.io/client-meeting-1117/notebooks/S4-backlog-outside-immigration-en.html)

## How the data gets to the page

```
foia.gov API (one JSON per annual report)
  └─ pipeline/download_api_annual.py            1,923 reports, FY2008–FY2025
      └─ pipeline/build_component_tables_from_api.py
          ├─ data/component_master_no_03_06_11.csv   one row per agency or component per year (244 measures)
          ├─ data/other_reasons_03_11.csv            "other" reasons, tables 03 and 11
          └─ data/exemption_statutes_06.csv          Exemption 3 statutes, table 06
              └─ pipeline/check_component_tables.py  every cell checked again before use
                  └─ pipeline/prep.py              -> docs/data/foia.json   (what the page reads)
```

The page itself never calls the API: it reads `docs/data/foia.json`.

## Folders

| Folder | What is in it |
|---|---|
| `docs/` | The page (served by GitHub Pages): `index.html` (the dashboard; its code is inside the file, see "The page's code"), `stories.js` / `stories.css` (guide, year slider, lists, links, short explanations), `styles.css` and `theme.css` (the look), `data/`, and the notebooks as HTML |
| `data/` | The three component-level tables built from the API (download of 2026-11-02; a second download on 11-06 gave identical tables), the agency-level table, and the data type map |
| `pipeline/` | API download, table build, checks (`foia_fields.py` holds the definitions they share), and `prep.py` with `column_mapping.csv` (foia.gov's own column names) |
| `storylines/notebooks/` | The four analysis notebooks (requests, outcomes, appeals, backlog) and `storyline_lib.py`; every figure in their text is checked with an assertion |
| `tools/` | `serve.py`: a local preview server without browser caching. `page_code.py`: writes out the dashboard code inside `docs/index.html`, and puts it back |

## Rebuild

Python 3 with pandas and matplotlib. Run from the repository folder.

```bash
# 1. Download the annual reports (free key from api.data.gov in ~/.foia_api_key; about two hours at the rate limit)
python pipeline/download_api_annual.py pipeline/report_data_map.json raw/api

# 2. Build the three component tables (the old component table only gives the column list)
python pipeline/build_component_tables_from_api.py raw/api pipeline/field_map.csv pipeline/report_data_map.json \
  data/FOIA_agency_FY2008-2025.csv data/component_master_no_03_06_11.csv data/data_type_map.csv data/new

# 3. Check them (also uses the team repository's agency_level folder and foia.gov's FY2024 component CSV export)
#    python pipeline/check_component_tables.py data/new <agency_level dir> raw/api pipeline/field_map.csv \
#      pipeline/report_data_map.json data/data_type_map.csv pipeline/column_mapping.csv <FY2024 component CSV dir> checks

# 4. The page's data file
python pipeline/prep.py --components data/component_master_no_03_06_11.csv --types data/data_type_map.csv \
  --mapping pipeline/column_mapping.csv --out docs/data

# Preview
python tools/serve.py 8000 docs      # then open http://127.0.0.1:8000/
```

Step 4 on the files in this repository gives exactly the `docs/data/foia.json` that is here (apart from its build
date).

## The page's code

`docs/index.html` was rendered once with Quarto and has been edited in place since; there is no separate source
file. The dashboard code that runs is in one `<script type="ojs-module-contents">` block of that file, encoded
(base64). To read or change it:

```bash
python tools/page_code.py unpack cells     # one file per cell: cells/c01.js ... c38.js
python tools/page_code.py pack cells       # write the edited cells back into docs/index.html
```

The guide, the year buttons and the links are plain files: `docs/stories.js`, `docs/stories.css`.

Three things to know before changing a cell:

- **The number of cells must stay the same**, and **a cell must not get a new top-level variable**: the page has one
  output slot for each, and a cell with an extra one stops working (every variable in it becomes undefined). Put new
  values inside a function, as `const`.
- **Do not name a variable `cards`.** Quarto adds `cards[...]` to every `Plot.plot` call to size charts to their card,
  and a variable of that name breaks them.
- Styles: `docs/styles.css` (base), `docs/stories.css` (guide and controls), `docs/theme.css` (the look; loaded last).
- Where things are: `c11` is the start page (`overview()`); `c10` has the question pages (`questionBlocks(q)`, one
  part per question) and the chart kit they share (`modKit()`); `c01`–`c03` and `c25` hold the colours, data and
  common settings. `c04`–`c09` are the first version's chart functions: nothing calls `chart1`–`chart6` any more, and
  `data1`–`data6` / `table1`–`table6` only feed the Tables tab, which is hidden. They are left in place because
  taking a variable out of a cell has the same risk as adding one.

## Notes

- **Missing is not zero.** Blank and "N/A" are kept as missing; "<1" (less than a day) is kept as "<1".
- **Missing is not zero in rates either.** A rate with a missing part (for example backlog ÷ requests received where
  no backlog is reported) is left blank.
- **No double counting.** On the question pages, government totals add agency totals only; components are never
  added on top of their agency.
- **The notebooks add up components.** The page adds agency totals; the notebooks add components (plus numbers
  not assigned to a component, and the totals of agencies without components), so that single units such as USCIS
  can be told apart. The two differ slightly where an agency's total and its components disagree: FY2025 requests
  received are 1,707,434 on the page and 1,707,413 in the notebooks; the 21 are at Veterans Affairs.
- **Department of War (Department of Defense).** DOJ's FY2025 summary uses the new name; foia.gov's data still says
  Department of Defense. The page shows the current name first and the former one in brackets, and `prep.py` keeps
  both spellings as one agency, so a later rename in the data does not split it in two.
- **Days are working days**, as the annual reports count them; the legal time limit is 20 working days.
- **The page loads no jQuery.** Quarto's sidebar code calls it once when the sidebar folds on a narrow screen;
  `stories.js` gives it a stand-in that does nothing.
- Team repository: https://github.com/BU-Spark/ds-muckrock-liberation
