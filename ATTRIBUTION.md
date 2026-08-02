# Attribution

## Open Food Facts

The drink catalog — product names, serving sizes, caffeine, sugar, calories,
barcodes — and the can photographs come from
[Open Food Facts](https://openfoodfacts.org), a collaborative, open database of
food and drink products.

- **Product data** is made available under the
  [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/),
  with individual contents under the
  [Database Contents License 1.0](https://opendatacommons.org/licenses/dbcl/1-0/).
- **Product photographs** are made available under
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) by Open Food
  Facts contributors. Attribution is required and derivative works must be
  shared under the same terms.

Every drink in the catalog keeps a `source` link back to its Open Food Facts
product page, and the footer of the site credits Open Food Facts.

Regenerate the catalog with:

```bash
npm run import:catalog          # uses the cache under .cache/off
npm run import:catalog -- --fresh   # re-fetch everything
```

### Trademarks

Open Food Facts' licences cover Open Food Facts' and its contributors' own
rights. They do not grant rights in third-party material that may appear in a
photograph — can artwork, logos and packaging remain the trademarks and
copyright of their respective owners. They are reproduced here for
identification in a comparative review context. No affiliation with or
endorsement by any brand is implied.

### Data quality

The importer rejects records it cannot trust rather than guessing:

- A can with no parseable volume is skipped.
- Caffeine outside a physically plausible density for its volume is rejected.
  This matters — contributors enter caffeine into a field that expects grams
  and frequently type milligrams, which produced Celsius cans claiming 710 mg
  against a real figure of 200 mg.
- Sugar and calorie figures are shown as "—" when Open Food Facts has no value,
  never as zero.

Nutrition figures are approximate and sourced from a crowd-maintained database.
Do not rely on them for medical or dietary decisions.
