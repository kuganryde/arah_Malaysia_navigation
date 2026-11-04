# Play "Data safety" answers (draft; reflects privacy.html at release 0.16.0, review before submitting)

ARAH has no accounts, no ads, no analytics and no data sale. Data leaves the device only to run the features below.

| Data type | Collected? | Shared? | Why | Optional? |
|---|---|---|---|---|
| Approximate / precise location | Yes: route start/end and map-search bias are sent to the routing and geocoding services (OSRM, Photon, Nominatim, Overpass) | Yes, with those service providers to answer the request | App functionality | No (needed for routing/search) |
| Search queries | Yes, sent to Photon/Nominatim | Yes, same providers | App functionality | No |
| Crash logs / diagnostics | Yes, only if the user switches "crash reports" on; scrubbed of location and URLs before sending (Sentry) | Yes, with Sentry | Analytics (stability) | **Yes** (off by default) |
| Camera frames (AR) | No: processed on the device, never transmitted | n/a | n/a | Yes |
| Personal info, financial, contacts, photos, audio, health | No | n/a | n/a | n/a |

- Data encrypted in transit: **Yes** (HTTPS everywhere).
- Users can request deletion: no account data exists; saved places and hazard reports are stored on the device and cleared by clearing app data.
- Independent security review: No.
- Location permission: foreground only, used while the map or a trip is open. No background location is declared. (Declare "foreground" in the Play permissions form.)
- Families policy: not designed for children.
