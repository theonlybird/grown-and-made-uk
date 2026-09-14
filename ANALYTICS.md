# Analytics

Google Analytics 4, behind an opt-in consent banner. Everything lives in
`assets/analytics.js` plus a few call sites in the page scripts.

## Before it does anything

Open `assets/analytics.js` and set the Measurement ID near the top:

```js
var MEASUREMENT_ID = 'G-XXXXXXXXXX';
```

Find it in Google Analytics under **Admin → Data streams → your web stream**.
While it is `null` the banner still appears and choices are still stored, but
no analytics load. That is a safe state to deploy in, and it is how the site
ships until the ID is pasted in.

## How consent works

This is Consent Mode v2 in its strict form. Nothing is requested from Google —
not even the gtag library — until a visitor presses Accept. The usual pattern
loads gtag immediately with consent denied; this does not, because
`privacy.html` promises it does not, and because under PECR a UK visitor who
has not consented should not be handed to Google at all.

- Default state: `analytics_storage`, `ad_storage`, `ad_user_data` and
  `ad_personalization` all denied.
- Accept → `analytics_storage` granted, gtag injected, nothing else changes.
  Advertising storage stays denied permanently; this site will never run ads.
- The answer is stored in `localStorage` under `gm_consent_v1`.
- Declining is remembered too, so nobody is asked twice.
- On the map the banner waits for the introduction sequence to finish rather
  than stacking two overlays.
- A "Cookie settings" link is injected into the footer of every page with one,
  and into the burger menu on the map. Anything with `data-consent-settings`
  also reopens it.

**If the privacy policy changes materially, bump `CONSENT_VERSION`.** Every
stored choice is discarded and everyone is asked again.

## Calling it

```js
gmTrack('event_name', { param: 'value' });          // any page
gmTrackBiz('event_name', businessObject, { ... });  // adds the business dimensions
```

Both are no-ops when analytics.js is missing, when the ID is unset, and when
consent has not been given. Call sites never need to check.

## Events

### The map (`index.html`)

| Event | When | Notable parameters |
|---|---|---|
| `business_click` | Website or Instagram link clicked | `link_type`, `surface` (`map_popup`/`grid_card`), `search_active`, `search_term` |
| `map_pin_open` | A pin's popup opened | `view_mode` |
| `business_focus` | A listing brought into view | `surface` (`map_list`, `autocomplete`, `grid_map_link`, `deep_link`, `search_exact_name`) |
| `search` | Any search resolved | `search_term`, `search_engine` (`ai`/`local`/`none`/`exact_name`), `search_results`, `search_place`, `search_audience` |
| `search_no_results` | Search found nothing at all | `search_term` |
| `search_error` | Search threw | `error_message` |
| `search_suggestion_select` | Autocomplete result chosen | `search_term` |
| `filter_change` | A chip toggled | `filter_group`, `filter_value`, `filter_selection` |
| `view_change` | Map/grid button pressed | `view_mode` |
| `intro_complete` / `intro_skipped` | Landing sequence finished or cut short | `intro_ms`, `skip_reason` |
| `deep_link_open` | Arrived on `?b=<id>` | `business_id`, `referrer` |
| `engaged_30s` | 30 seconds on the map | — |

Every `business_*` event also carries `business_id`, `business_name`,
`business_tier`, `business_category`, `business_county` and `business_nation`.

`view_change` fires only from the toggle button. A search switches the view
programmatically and that is not a visitor choosing a view.

### Suggestions (`submit.html`)

`suggestion_started` (first keystroke), `suggestion_invalid` (with the
`field_name` that blocked submission), `suggestion_submitted`,
`suggestion_failed`.

The business being suggested is never sent — only `suggestion_category`,
`suggestion_listing_type`, `suggestion_relationship` and `has_evidence`. None
of the submitter's own details leave the page.

### Listing updates (`update.html`)

`listing_update_opened`, `tier_appeal_opened`, `removal_requested`,
`listing_update_submitted` (with `fields_changed`, `changed_field_names`,
`has_appeal`, `has_removal`, `pin_moved`), `listing_update_failed`,
`listing_update_error`.

**The token in the update URL is a credential and is never sent to Analytics.**
Only `business_id`, which is public. Pin coordinates are never sent either —
only the fact that a pin moved.

## What is deliberately not tracked

- `admin.html`. It carries no analytics script at all.
- Anything a visitor types into a form field.
- Map pin coordinates from the update page.
- The `k=` token from update links.
- Any advertising or cross-site identifier.

## Setting it up in GA4

Custom parameters are invisible in reports until they are registered.
**Admin → Custom definitions → Create custom dimension**, scope Event, for each:

```
business_id        business_name      business_tier     business_category
business_county    business_nation    link_type         surface
search_engine      search_place       search_audience   view_mode
search_active      filter_group       filter_value      field_name
suggestion_relationship                suggestion_category
```

`search_term` and `search_results` are recognised by GA4 already.

There is a limit of 50 event-scoped custom dimensions, so there is room. Add
them before you need the reports — GA4 does not backfill, so a dimension
registered in March shows nothing for February.

Then **Admin → Events → mark as key event**: `business_click`,
`suggestion_submitted`, `listing_update_submitted`.

Set **Admin → Data settings → Data retention** to 14 months (the default of 2
months is short for a site with this much seasonality).

## The reports worth building

- `business_click` by `business_name` — which makers people actually visit.
- `search` where `search_results` is 0 or low, by `search_term` — the single
  most useful report on the site. Every one is a candidate for the next round
  of listings research.
- `map_pin_open` against `business_click` for the same listing — a high ratio
  means the popup answers the question and the visitor never needs the
  website; a low one means the opposite.
- `business_click` by `business_county` — where the map is thin.
- `suggestion_invalid` by `field_name` — a form question that is badly worded
  rather than a careless visitor.

## A caveat on the numbers

Only visitors who press Accept are counted, so expect to see roughly half to
two thirds of real traffic. The shape is reliable; the absolute totals are a
floor, not a count. Vercel's own request logs remain the honest figure for
"how many people came".
