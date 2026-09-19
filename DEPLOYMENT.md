# Coral Gold — going live on Hostinger

## First, the one thing to understand

There are **two separate halves**, and only one of them comes from GitHub:

| | What it is | Where it comes from |
|---|---|---|
| **The code** | The web pages, the order portal, the admin panel | GitHub → Hostinger, automatically, on every push to `production` |
| **The database** | Products, party accounts, quotations, website text | **You create it once inside Hostinger.** It is never in GitHub |

Database passwords must never sit in a public repository, so the database
and its password live only on your Hostinger account. Pushing code does not
create the database — that is the part you do by hand, once.

After that one-time setup, everything is automatic: pushes deploy the code,
and the admin panel edits the data.

---

## Order of work

1. **Steps 1–2 below — do these now**, before the site goes to production.
   They only touch Hostinger, nothing to do with the code.
2. Tell me **"move production"**. I push the code to the `production` branch
   and Hostinger deploys it.
3. **Steps 3–5 below** — finish the setup on the live site.

---

## Before you start

Check your Hostinger plan includes **PHP** and **MySQL**. Every Premium /
Business / Cloud shared-hosting plan does. (If you are on a static-only
plan, the order portal cannot run — tell me and we will sort it out.)

In hPanel, under **Websites → your site → Advanced → PHP Configuration**,
make sure the PHP version is **8.0 or newer**.

---

## Step 1 — Create the database

hPanel → **Databases → MySQL Databases**.

Fill in the "Create a New MySQL Database and Database User" form:

- **Database name** — e.g. `coral`
- **Database username** — e.g. `coral_user`
- **Password** — click Generate, or use a long one of your own

Press **Create**.

Hostinger will show the *full* names, which are longer than what you typed —
something like `u123456789_coral` and `u123456789_coral_user`. **Write down
all four values**, exactly as shown:

```
Database name:  u123456789_coral
Username:       u123456789_coral_user
Password:       ••••••••••••
Host:           localhost
```

You need these in Step 3. (Host is almost always `localhost` on Hostinger —
if the panel shows something different, use what it shows.)

---

## Step 2 — Create the tables

Still in **Databases → MySQL Databases**, find your new database in the list
and click **Enter phpMyAdmin**.

On the left, click your database name, then the **Import** tab at the top.

Import these two files from this repository, **one at a time, in this
order**:

1. `sql/schema.sql` — creates the empty tables
2. `sql/seed.sql` — loads the four categories, the five product photos, and
   the current website text

For each one: **Choose File** → pick the file → scroll down → **Import**.
You should see "Import has been successfully finished" both times.

To confirm, click the database name on the left — you should now see nine
tables: `admins`, `cart_items`, `categories`, `login_attempts`, `parties`,
`products`, `quotation_items`, `quotations`, `site_content`.

> Download the two files from GitHub first: open the repo, go into the `sql`
> folder, click the file, then the **Download raw file** button.

---

## Step 3 — Tell the site its database password

**Do this after the code is on production.**

hPanel → **Files → File Manager** → open `public_html` → open the
`includes` folder.

You will see a file called `config.sample.php`. Right-click it → **Copy**,
and name the copy **`config.php`** in the same folder.

Now right-click `config.php` → **Edit**, and replace the three placeholders
with your values from Step 1:

```php
'db' => [
    'host'    => 'localhost',
    'name'    => 'u123456789_coral',
    'user'    => 'u123456789_coral_user',
    'pass'    => 'your-real-password-here',
    'charset' => 'utf8mb4',
],
```

Save.

`config.php` is deliberately excluded from GitHub, so it stays put and is
never overwritten by future deploys. You only ever do this once.

---

## Step 4 — Create your admin account

Open **`https://yourdomain.com/admin/setup.php`** in a browser.

Choose your admin username and password. This is the login for the Coral
Gold admin panel.

That page only works while no admin exists — the moment you create the first
account it refuses to run, so there is no default password anywhere and
nothing for you to delete afterwards.

From then on you sign in at **`https://yourdomain.com/admin/`**.

---

## Step 5 — Allow product photo uploads

In File Manager, right-click the `assets/uploads` folder → **Permissions** →
set it to **755**.

Only needed if photo uploads fail with an error; most Hostinger accounts
work without changing anything.

---

## Check it worked

| Address | What you should see |
|---|---|
| `yourdomain.com` | The public website |
| `yourdomain.com/catalog.html` | The five products (no jewel codes or weights) |
| `yourdomain.com/admin/` | Admin login |
| `yourdomain.com/login.php` | Wholesaler login |

Then, as a real test: in the admin panel create a party account, sign out,
sign in at `/login.php` with it, add an item, and generate a quotation.

---

## If something goes wrong

**"Configuration missing"** — `includes/config.php` does not exist yet, or
is in the wrong folder. Redo Step 3.

**"Database connection failed"** — one of the four values in `config.php` is
wrong. The most common cause is using the short name you typed instead of
the full `u123456789_` name Hostinger generated.

**Blank white page** — PHP version is too old. Set it to 8.0+ in hPanel →
PHP Configuration.

**Products do not appear** — `sql/seed.sql` was not imported, or was
imported into a different database. Check in phpMyAdmin that the `products`
table has five rows.

---

## Day-to-day, once live

**Add a wholesaler:** Admin → Parties → *Add party*. Choose their Party ID
and a temporary password, and give both to them. They set their own password
the first time they sign in. Wholesalers cannot register themselves or
recover a forgotten password — you reset it from Parties → Edit.

**Add products:** Admin → Products → *Add product*. Design number, jewel code
and the two weights show **only** inside the wholesaler section; the public
catalogue shows just the photo, name, design number and description.

**Edit website text:** Admin → Site Content. Saving publishes immediately.

**See quotations:** Admin → Quotations — every quotation from every party,
filterable by party, number or date, each with its PDF.

---

## Backups

The database holds your catalogue, party accounts and every quotation —
none of it is in GitHub. Turn on Hostinger's automatic backups
(hPanel → **Files → Backups**), or export the database now and then from
phpMyAdmin (**Export → Quick → SQL → Go**).

---

## Notes for a developer

- `includes/`, `sql/` and `vendor/` each carry an `.htaccess` denying direct
  web access. On a non-Apache server, block those three directories in that
  server's config instead.
- `vendor/` (DomPDF, for quotation PDFs) is committed so the site runs
  without Composer on the server.
- Schema changes go through new files in `sql/`, imported the same way.
