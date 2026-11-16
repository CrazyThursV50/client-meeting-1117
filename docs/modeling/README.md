# FOIA Modeling Lab

An interactive prototype built on the local `v4a` dashboard (base commit `3ace73c`). The original dashboard remains available at `../`; its header links to this experiment. No production site configuration is changed.

## Try it

From the repository root:

```sh
python3 -m http.server 8784 --bind 127.0.0.1 --directory docs
```

Open `http://127.0.0.1:8784/modeling/`.

1. Select an agency, component and fiscal-year range.
2. Choose one of six guided questions. These are editable starting paths, not predetermined conclusions.
3. Add any of the 32 datatype modules from the left library. Click or drag a module onto the canvas.
4. Select up to four fields for a comparison, or exactly two fields for arithmetic. First selected is A, second is B. Swap A/B to change direction.
5. Choose comparison, ratio, percentage or difference. The flow diagram shows the selected fields, operation and chart output.
6. Switch between line, bar and table views. Inspect coverage and export CSV.
7. Save/load a JSON recipe or copy a URL containing the scope, modules, fields, operation and chart type. A shared localhost URL only works on the machine serving it; use a deployed URL for external sharing.

The recommendation box supports English/Chinese keywords and suggests a guided path. It is explicitly a **local rule-based prototype**, not a connected language model. Applying a suggestion replaces the current canvas.

## Six starting paths

| Question | Modules loaded | Initial view |
| --- | --- | --- |
| Q1 Intake & processing | 01 | Processed / received × 100 |
| Q2 Response time | 14, 16, 17, 19, 20 | Simple vs complex median days |
| Q3 Capacity & resources | 01, 22, 23, 26 | Processed / total FOIA staff |
| Q4 Outcomes & exemptions | 02, 05, 03, 06 | Full grants / total dispositions × 100 |
| Q5 Appeals | 07, 08, 12, 26 | Completely reversed/remanded / all dispositions × 100 |
| Q6 Backlog & intake | 01, 26, 19, 30 | Year-end request backlog / received × 100 |

Each template is one initial lens, not exhaustive coverage of its question. Users can select other fields in its modules and add modules from the full library.

## Data and calculation rules

- Numeric observations use the existing `../data/foia.json` API-derived snapshot. This is not a live API query; its build date is displayed.
- All 32 datatype names come from `data/data_type_map.csv`.
- Descriptive records for 03, 06 and 11 come from the existing `other_reasons_03_11.csv` and `exemption_statutes_06.csv`. Rebuild their JSON and the catalog with `python3 tools/build_modeling_catalog.py`. The detail table shows the first 150 matching records and explicitly labels this limit.
- Government totals use agency-level rows only. A selected component uses its own rows; parent totals are not added to component values.
- Missing observations stay missing. Zero is a valid observed value. Zero or negative divisors do not produce ratios.
- Government ratios use the intersection of rows with both inputs present. Coverage counts accompany each year. Different years may have different reporting agencies; national trends are not a fixed-cohort estimate.
- Fields marked nonadditive in the source metadata cannot be summed across agencies. There is no averaging of agency medians.
- Source `<1` flags are preserved. These observations appear as `<1` for a single row and are omitted from exact plotted/derived values. Stored 0.5 placeholders are never treated as exact measurements.
- Different units cannot share one overlay axis or be subtracted. Ratios remain exploratory: arithmetic compatibility does not establish population comparability or substantive validity.
- An exemption application count is not a unique-request count; backlog is a year-end stock and intake is a yearly flow. Template annotations explain these distinctions.
- Years in comparisons modules 29–32 retain the report-year labels from the existing dataset. “Last year” fields are not automatically shifted or spliced into a revised time series.

## Scope and limitations

This first version demonstrates the modular workflow, not a full Tableau replacement. The graph visualizes the current operation; it does not yet support freely drawn edges, multiple operation layers, branching outputs, a semantic relationship catalog, multiple saved charts on one canvas, or multi-agency overlays. Card dragging changes module order; checkbox selection establishes inputs. Use the original dashboard for its broader agency-comparison experience.

The assistant has no remote model, and no question or data is sent to an AI service. Text records are descriptive evidence, not automatically joinable request-level records. No causal inference is performed. A user can still create a substantively inappropriate ratio; the prototype warns about interpretation but does not yet enforce all domain-specific denominator rules.

## Validation

```sh
node --test docs/modeling/engine.test.mjs
```

15 tests cover all six templates using the real dataset, agency/component scope, matched reporting populations, missing values, zero denominators, nonadditive measures, `<1` handling, unit checks and recommendations.

An optional DOM smoke test exercises the rendered document structure and event handlers using jsdom:

```sh
JSDOM_PATH=/absolute/path/to/jsdom/lib/api.js node tools/test_modeling_ui.mjs
```

It checks the 32-module library, six templates, field selection, A/B swapping, chart/table controls, filtering, detail records, recommendations and year-range updates. This is not browser visual QA. Responsive CSS is included, but real-browser layout and drag/drop behavior still need hands-on review.
