# Installing Cake Studio on a client's computer

Three things, in this order:

1. **PostgreSQL** — installed on the client's PC (free, official installer).
2. **Your database** — backed up on your PC, restored on the client's PC by hand.
3. **`CakeStudio-Setup-1.0.0.exe`** — installs the app and connects it to that database.

The counter PC, bakers' tablets and riders' phones then just open Cake Studio
in a browser over the shop's Wi-Fi.

---

## On your computer

### Back up your database

```powershell
cd E:\Projects\cake-studio\installer
Set-ExecutionPolicy -Scope Process Bypass
.\export-database.ps1                      # -> E:\Projects\cake_studio.sql
```

(Want to remove test orders first? `cd ..\backend`, `.\venv\Scripts\Activate.ps1`,
`python -m scripts.reset_for_deployment --keep-staff YOUR-ADMIN-EMAIL`.)

### Build the installer

One-time: install **Inno Setup 6** (free) from https://jrsoftware.org/isdl.php

```powershell
.\build-installer.ps1 -Version 1.0.0       # -> installer\output\CakeStudio-Setup-1.0.0.exe
```

It also packs your **logo and favicon** (they're files, not in the database).

Copy **`cake_studio.sql`** and **`CakeStudio-Setup-1.0.0.exe`** to the client's PC (USB drive is fine).

---

## On the client's computer

### Step 1 — Install PostgreSQL

1. Download it from https://www.postgresql.org/download/windows/ and run the installer.
2. Keep the **default options** (port **5432**). Untick *Stack Builder* at the end.
3. **Write down the password** you set for the `postgres` user.

### Step 2 — Restore your database

Open **PowerShell** and run (change `18` to the PostgreSQL version you installed,
and the path to where you copied the file):

```powershell
$pg = "C:\Program Files\PostgreSQL\18\bin"
& "$pg\psql.exe" -h localhost -U postgres -c "CREATE DATABASE cake_studio"
& "$pg\psql.exe" -h localhost -U postgres -d cake_studio -f "C:\Users\$env:USERNAME\Desktop\cake_studio.sql"
```

Each command asks for the `postgres` password. The second prints a lot of
lines — that's normal. (A warning about the "console code page" is harmless.)

### Step 3 — Install Cake Studio

1. Double-click **`CakeStudio-Setup-1.0.0.exe`** → **Yes**.
   If *"Windows protected your PC"* appears: **More info → Run anyway**.
2. **Database connection** page — already filled in: server `localhost`, port
   `5432`, database `cake_studio`, user `postgres`. Type the **`postgres`
   password** and click **Next**. It checks the connection (a few seconds) and
   says plainly if anything's wrong.
3. **Shop settings** — keep `Asia/Karachi` and port `8000`, **Next**, **Install**.
4. The last screen shows the **address for tablets and phones**
   (e.g. `http://192.168.1.20:8000`). Click **Finish** — Cake Studio opens.
5. **Sign in with your usual account** — it came with your database.

### After installing (once)

- [ ] **Wi-Fi router:** give this PC a **fixed IP** so the tablet address never changes.
- [ ] **Power settings:** set the PC to **never sleep**.
- [ ] **System setup:** printer IP + **Test print**; **Business date → Use system date**.
- [ ] On each tablet/phone: open the address → **Add to Home screen**.

---

## Day to day

Nothing: Cake Studio starts with Windows and restarts itself if it stops.
Backups run every night at 11 pm into `C:\ProgramData\CakeStudio\backups`
(Start menu → **Back up now** for one any time). **Copy one to a USB drive or
cloud folder every week.**

| If… | Do this |
|---|---|
| The app won't open | Restart the PC; still not? See `C:\ProgramData\CakeStudio\logs\server.log` |
| Tablets can't connect | Check the PC is awake, on the same Wi-Fi, and its IP hasn't changed |
| Restore a backup | Each backup `.zip` contains `database.sql`: restore it with Step 2 into a fresh database |

## Updating

Run the new `CakeStudio-Setup-<version>.exe`. It backs up first, keeps the
connection and settings, brings the tables up to date, and restarts.

## If an install fails

Fix what the message says and **run the installer again** — after a failed
attempt it asks for the database details again. Install logs are in
`C:\ProgramData\CakeStudio\logs`.

## Uninstalling

Settings → Apps → Cake Studio → Uninstall. **Your PostgreSQL database is never
deleted.** It asks whether to also remove Cake Studio's own files in
`C:\ProgramData\CakeStudio` (default: keep).

## Good to know

- For use **inside the shop's network** only. Reaching it from the internet
  needs HTTPS and a proper web server in front.
- `installer\cache`, `installer\build` and `installer\output` are generated;
  don't commit them.
