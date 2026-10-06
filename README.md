# Library Management System

A web-based Library Management System built with **Node.js, Express, EJS, and SQLite**. It replaces manual book registers with a searchable digital catalog, a one-tap borrow/return workflow, automatic fine calculation, and an admin dashboard.

## Features

- 🔐 Member registration & login (admin account seeded automatically)
- 📚 Book catalog with search by title, author, or genre
- 🔁 Borrow / return workflow with automatic due dates
- 💰 Automatic overdue fine calculation
- 🛠️ Admin tools: add/edit/delete books, view & process all loans
- 📊 Admin dashboard: stock levels, active/overdue loans, fines collected, most-borrowed books

## Tech Stack

| Layer      | Technology                  |
|------------|------------------------------|
| Backend    | Node.js, Express.js          |
| Views      | EJS (server-rendered HTML)   |
| Database   | SQLite (via better-sqlite3)  |
| Auth       | express-session + bcryptjs   |

SQLite was chosen deliberately: it needs no separate database server to install or configure, which makes the project easy to run locally and easy to defend ("how does your data get stored?") without extra moving parts.

## Project Structure

```
lms-code/
├── config/
│   └── database.js        # DB connection, schema, seed data
├── middleware/
│   └── auth.js             # login/role-check middleware
├── routes/
│   ├── auth.js              # register, login, logout
│   ├── books.js             # catalog CRUD + search
│   ├── loans.js             # borrow, return, fine logic
│   └── admin.js             # dashboard stats
├── views/                  # EJS templates
├── public/css/style.css    # styling
├── data/                   # SQLite database file (auto-created)
├── server.js                # app entry point
└── package.json
```

## Running Locally

**Requirements:** Node.js 18+ installed on your machine.

```bash
# 1. Install dependencies
npm install

# 2. Copy the example environment file and edit if you like
cp .env.example .env

# 3. Start the app
npm start
```

Visit `http://localhost:3000` in your browser.

On first run, the app automatically:
- Creates the SQLite database and tables
- Seeds a default **admin** account (check your `.env` / `.env.example` for the email & password — change the password after logging in)
- Seeds a handful of sample books so the catalog isn't empty

## Pushing This Project to GitHub

```bash
cd lms-code
git init
git add .
git commit -m "Initial commit: Library Management System"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

> `.gitignore` already excludes `node_modules/`, `.env`, and the local database file, so your secrets and generated data won't be pushed.

## Hosting It Online (Free Options)

Once it's on GitHub, you can deploy it for free — entirely through each platform's website, no local setup required:

**Render.com** (recommended, simplest)
1. Sign in with your GitHub account.
2. Click **New → Web Service** and select your repo.
3. Build command: `npm install` · Start command: `npm start`.
4. Add environment variables from `.env.example` in the Render dashboard.
5. Deploy — Render gives you a live `https://...onrender.com` URL.

**Railway.app** works almost identically — connect the GitHub repo, set the same environment variables, and deploy.

> Note: Render's free tier uses an ephemeral filesystem, so the SQLite file resets on redeploy/restart. That's fine for a demo/defense. If your supervisor wants persistent production data later, the natural upgrade is swapping SQLite for a hosted Postgres/MySQL instance — worth mentioning if asked about scaling.

## Default Admin Login

After first run, check your `.env` file for:
```
ADMIN_EMAIL=admin@library.com
ADMIN_PASSWORD=Admin@12345
```
Log in with these, then change the password (via the database or by extending the app with a "change password" feature — a good talking point for "what would you improve next?").

## How the Core Workflow Works (for your defense)

1. **Report/Borrow**: A logged-in member clicks "Borrow" on a book with available copies. A `loans` row is created with a due date (`LOAN_PERIOD_DAYS` from `.env`, default 14 days), and `available_copies` on the book decreases by 1.
2. **Return**: An admin marks a loan "Returned." The system calculates a fine if the return date is past the due date (`FINE_PER_DAY` × days late), and `available_copies` increases by 1 again.
3. **Fines**: Calculated live — a member can see their current running fine on an overdue loan even before it's returned.
4. **Dashboard**: Aggregates counts directly from the `loans` and `books` tables using SQL (`COUNT`, `SUM`, `GROUP BY`) rather than storing duplicate stats.
