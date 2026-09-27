# Installing Cake Studio on a client's computer

One Windows PC in the shop runs Cake Studio. Everyone else — the counter PC,
bakers' tablets, riders' phones — opens it in a web browser over the shop's
Wi-Fi. Nothing is installed on those devices.

```
  Tablets / phones / other PCs  ──Wi-Fi──►  Server PC  (Cake Studio + PostgreSQL)
      http://192.168.1.20:8000                runs by itself, starts at boot,
                                              backs up every night
```

---

## 1. On your computer: make the package

```powershell
cd E:\Projects\cake-studio\deploy
.\make-package.ps1
```

This builds the web app and creates **`E:\Projects\cake-studio-deploy.zip`**.
It leaves out your development files, your `.env` secrets, backups and test photos.

**Optional — bring your prepared setup** (organisation, logo, cake menu, staff):
first clear test data with `python -m scripts.reset_for_deployment --keep-staff YOUR-ADMIN-EMAIL`,
then save the database:

```powershell
$env:Path += ";C:\Program Files\PostgreSQL\18\bin"
pg_dump -h localhost -U cake -d cake_studio --no-owner -f E:\Projects\client-setup.sql
```

Take `client-setup.sql` with the zip. Without it the client starts with a fresh
system and the default roles, and you set everything up on their PC.

## 2. On the client's computer: install the two prerequisites

1. **Python 3.12 or newer** — python.org. On the first screen tick
   **"Add python.exe to PATH"**.
2. **PostgreSQL 16 or newer** — postgresql.org. Remember the password you set
   for the `postgres` user; the installer asks for it once.

## 3. Install Cake Studio

1. Unzip `cake-studio-deploy.zip` to **`C:\CakeStudio`** (so you have `C:\CakeStudio\cake-studio\backend`, `deploy`, `frontend`).
2. Open **PowerShell as Administrator** (Start → type PowerShell → right-click → *Run as administrator*).
3. Run:

```powershell
cd C:\CakeStudio\cake-studio\deploy
Set-ExecutionPolicy -Scope Process Bypass
.\install.ps1
```

With your prepared setup instead:

```powershell
.\install.ps1 -RestoreFrom C:\CakeStudio\client-setup.sql
```

It takes a few minutes (it downloads the Python packages, so it needs internet
once). At the end it prints the address for tablets and phones, e.g.
`http://192.168.1.20:8000`.

What the installer sets up: the database and its own user with a random
password · a random security key in `backend\.env` · the tables · a Windows
Firewall rule so tablets can connect · a **"Cake Studio Server"** task that
starts the server at boot and restarts it if it stops · a **"Cake Studio
Backup"** task every night at 11 pm.

## 4. First sign-in and handover checklist

- [ ] Open the address on the server PC and on one tablet.
- [ ] Fresh install: sign in as `owner@cakestudio.local` / `change-me` and **change the password immediately**.
      (With `-RestoreFrom`, use the admin login from your prepared database.)
- [ ] Create the client's own Super Admin under **Staff**, and remove or rename yours.
- [ ] **Organization**: company name, logo, address, currency, time zone.
- [ ] **Order setup**: replace the sample flavours, sizes and add-ons with the client's menu.
- [ ] **System setup → Business date**: usually **Use system date**.
- [ ] **System setup → Kitchen ticket printing**: enter the printer's IP and press **Test print**.
- [ ] In the **Wi-Fi router**, give the server PC a **fixed IP** (DHCP reservation), so the tablet address never changes.
- [ ] Set the server PC to **never sleep** (Settings → Power), or tablets lose the connection.

## Day to day

| Task | How |
|---|---|
| Server stopped? | Restart the PC, or run `Start-ScheduledTask "Cake Studio Server"` as Administrator |
| See what happened | `C:\CakeStudio\cake-studio\backend\logs\server.log` |
| Back up now | `C:\CakeStudio\cake-studio\deploy\backup.ps1` |
| Backups | `backend\backups` — last 30 days. **Copy one to a USB drive or cloud folder every week**: backups on the same PC don't survive a failed disk. |
| Restore a backup | Stop the server task, then `psql -U cake -h localhost -d cake_studio -f backend\backups\<file>.sql` into an empty database |
| Can't sign in | `cd backend; .\venv\Scripts\Activate.ps1; python -m scripts.accounts --test-login EMAIL` |

## Updating to a new version

1. On your PC: `.\make-package.ps1` again.
2. On the client PC, as Administrator: run `deploy\backup.ps1` first.
3. Stop the server: `Stop-ScheduledTask "Cake Studio Server"`.
4. Unzip the new package over `C:\CakeStudio` (it never contains `.env`, backups or photos, so those are kept).
5. Run `.\install.ps1` again — it keeps the existing database and data, adds any new tables and restarts the server.

## Good to know

- This setup is for use **inside the shop's network**. Putting it on the internet
  (for customers or staff at home) needs HTTPS and a proper web server in front;
  don't just open the port on the router.
- The `backend\.env` file holds the database password and security key. Don't
  share it or copy it to other machines.
