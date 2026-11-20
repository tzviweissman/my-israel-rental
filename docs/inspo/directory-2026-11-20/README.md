# Directory and browse pages (20 Nov 2026)

Tzvi: "right now its just a big mix of many different types of moving business pages i want it more organized and
also i want their to be more subcategories for shops and products". Studied before re-cutting `/businesses`
(`frontend/src/pages/Services.jsx`, `components/showcase/ShowcaseStrip.jsx`).

## What /businesses was on 20 Nov 2026

`ours-before.jpg`: 24 moving business-page tiles in one grid in no order (cinnamon buns, kitchen kashering, cholent,
a trainer, meat boards...), then 54 listing cards just as mixed. The only sorting was the "All businesses" picker in
the search bar. Shops & Products held 27 of the 78 live listings with no subcategory. Food sellers were split between
Shops & Products (bakeries, boards, coffee) and Events, Music & Catering (Bake away, Chicken Munch, LS Fruit Platter,
L.A. Cholent).

## What real browse pages do (Mobbin, web)

| File | What to take |
|---|---|
| `mobbin-base44.jpg` | One row of category chips under the search, "All" first; a plain 4-across grid under it |
| `mobbin-higgsfield-skills.jpg` | Category tabs with an icon each; picking one filters the grid in place |
| `mobbin-dribbble.jpg` | Category tabs across the top, a Filters button on the right for everything else |
| `mobbin-zoho.jpg` | Featured block first, then an editor's pick row, then tags with counts |
| `mobbin-databricks.jpg` | Featured row, then "staff picks" row: rows by theme, each with "see all" |
| `mobbin-jira.jpg` | Filter dropdowns (price, categories, use cases) over a result count and sort |
| `mobbin-skillshare.jpg` | Every card labelled with its subcategory above the title |
| `mobbin-mercor.jpg` | Tabs for the three kinds of work, then the grid |

Common to all: nothing puts every kind of item in one mixed grid. A category bar comes first, a category opens
subcategory chips, and the "All" view is rows by theme, each with "See all".

## What we built from it

`preview-*.jpg`, and the preview page https://claude.ai/artifact/9qtcEt5YgtqwypVxMQCbBx: a category bar with icons
and counts; "All" is one row per category (business pages first, then listings, "See all"); a category shows its
subcategory chips with counts, business pages in a grid, then the listings. One film plays per row: the first
business page fully in view, or the one under the pointer; the rest show their still.

Tzvi, 20 Nov 2026: "Keep intros". In the "All" view every category row opens on an intro tile: four of its own product photos (never the website stills beside it), the category name in the serif, one short line, and the count; tapping it opens the category.
