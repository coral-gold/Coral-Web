# Coral Gold — Hostinger deployment

The site is PHP 8 + MySQL. Everything below is done once, in Hostinger's
hPanel; after that, pushing to the `production` branch deploys as usual.

## 1. Requirements

- PHP 8.0 or newer with `pdo_mysql` and `gd` (standard on Hostinger).
- A MySQL database.

## 2. Create the database

hPanel → **Databases → MySQL Databases** → create a database and a user,
and note the database name, username and password.

Then hPanel → **phpMyAdmin** → select the new database → **Import**, and
import these two files from the repo, in order:

1. `sql/schema.sql` — creates the tables
2. `sql/seed.sql` — loads the four categories, the five existing product
   photos, and the current website text

## 3. Add the config file

`includes/config.php` is intentionally **not** in git — database passwords
must never be committed. Create it once on the server:

hPanel → **File Manager** → `includes/` → copy `config.sample.php` to
`config.php`, then fill in the database name, user and password from step 2.

It survives future deploys because git never touches it.

## 4. Create the admin account

Visit **`https://yourdomain.com/admin/setup.php`** once and choose your
admin username and password.

That page only works while no admin exists — the moment the first account
is created it refuses to run, so there is no default password anywhere and
nothing to delete afterwards. Afterwards, sign in at `/admin/`.

## 5. Check the uploads folder is writable

Product photos uploaded through the admin panel are saved to
`assets/uploads/`. If uploads fail, set that folder's permissions to `755`
(or `775`) in File Manager.

## 6. Verify

- `https://yourdomain.com/` — public site
- `https://yourdomain.com/catalog.html` — catalogue (no jewel codes/weights)
- `https://yourdomain.com/login.php` — wholesaler login
- `https://yourdomain.com/admin/` — admin panel

---

## Day-to-day use

**Adding a wholesaler:** Admin → Parties → *Add party*. Choose their Party
ID and a temporary password, and pass both to them. They will be asked to
set their own password the first time they sign in. Parties cannot register
themselves or reset their own forgotten password — you reset it from
Parties → Edit → *Reset password*.

**Adding products:** Admin → Products → *Add product*. Design number, jewel
code and the two weights appear **only** inside the logged-in wholesaler
section; the public catalogue shows just the photo, name, design number and
description.

**Editing website text:** Admin → Site Content. Saving publishes immediately.

**Quotations:** Admin → Quotations lists every quotation from every party,
filterable by party, number or date, with the PDF downloadable for each.
Quotations carry no prices by design — rates are agreed with the party
separately.

## Backups

The database holds the catalogue, party accounts and every quotation. Set
up Hostinger's automatic backups, or export the database periodically from
phpMyAdmin (**Export → Quick → SQL**).

## Notes

- `includes/`, `sql/` and `vendor/` each carry an `.htaccess` denying direct
  web access. If you ever move the site to a non-Apache server, block those
  three directories in that server's config instead.
- `vendor/` (DomPDF, for the quotation PDFs) is committed so the site works
  without running Composer on the server.
