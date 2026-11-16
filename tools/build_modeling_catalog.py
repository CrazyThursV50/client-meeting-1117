#!/usr/bin/env python3
"""Rebuild the Modeling Lab catalog and text records from the existing source CSVs."""
import csv
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
out = root / 'docs' / 'modeling'
modules = [dict(no=r['No.'], name=r['foia.gov data type'], source=r['Official file name (foia-*.csv)'])
           for r in csv.DictReader((root / 'data/data_type_map.csv').open())]
(out / 'modules.json').write_text(json.dumps(modules))
records = []
for name in ['other_reasons_03_11.csv', 'exemption_statutes_06.csv']:
    for r in csv.DictReader((root / 'data' / name).open()):
        records.append(dict(no=r.get('Data Type No.', '06'), year=int(r['Fiscal Year']), agency=r['Agency'],
                            component=r['Component'], level='agency' if r['Row Type'] == 'agency_overall' else 'component',
                            text=r.get('Reason', r.get('Statute', '')), info=r.get('Type of Information Withheld', ''),
                            citation=r.get('Case Citation', ''), value=r.get('Quantity', r.get('Number of Times Relied Upon', ''))))
(out / 'details.json').write_text(json.dumps(records, separators=(',', ':')))
print(f'Built {len(modules)} modules and {len(records)} detail records.')
