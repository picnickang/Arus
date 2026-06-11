# CRUD Test Matrix — Vessel Intelligence Hub v4

## Diagram CRUD

- create diagram metadata
- upload valid SVG / PNG / JPG / WebP
- reject unsupported file type
- reject oversized file
- reject unsafe SVG script/event/external reference/foreignObject
- read list/detail
- update name/kind/notes
- set primary
- upload replacement version
- set active version
- verify old version remains in history
- archive/delete diagram
- restore as draft if supported
- tenant isolation
- unauthorized upload/replace/delete blocked
- audit log written

## Section Map CRUD

- create section map for active diagram
- clone existing map to draft
- import/export map JSON
- read active map
- create section polygon
- update section name/type/color/description/label point
- update normalized polygon coordinates
- reject invalid polygon outside bounds
- assign multiple equipment items to one section
- remove one equipment assignment and preserve others
- reorder equipment display order
- hide/show section
- archive/delete section
- validate draft map
- publish draft map
- verify old map archived/versioned
- mobile and desktop read same published map

## Thumbnail CRUD

Section thumbnails:

- upload/read/replace/update crop/delete
- generate from schematic crop
- fallback to crop/placeholder/icon
- reject invalid media
- tenant isolation
- unauthorized mutation blocked

Equipment thumbnails:

- upload/read/replace/update crop/delete
- fallback to asset photo, section thumbnail, generic icon
- reject invalid media
- tenant isolation
- unauthorized mutation blocked

## Operational Regression

- technical alerts create work orders and expert cases
- emergency safety alarms remain in Safety
- maintenance queue deep-links into Vessel Intelligence only when vessel-linked
- Crew, Logistics, Inventory, Safety, Admin, dashboards and login still work
- old Fleet/PDM/Equipment routes redirect correctly

## Playwright Smoke

Desktop super admin:

1. upload schematic
2. choose keep map as draft
3. edit section polygon
4. assign multiple equipment
5. upload section thumbnail
6. upload equipment thumbnail
7. validate and publish
8. verify operational hub renders active diagram/map/thumbnails
9. replace schematic and verify version history

Mobile permitted user:

1. open vessel twin
2. view active diagram
3. tap section
4. view equipment/thumbnails
5. open work order
6. attach evidence draft
7. verify controls hidden without management permissions
