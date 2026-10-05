; Cake Studio installer - compile with Inno Setup 6 (build-installer.ps1 does this).
; Installs the APP ONLY. PostgreSQL and the Cake Studio database are set up by
; hand first (install PostgreSQL, restore your backup); this installer asks for
; that database's connection, checks it, and runs tools\setup.ps1 to connect
; the app, bring the tables up to date, and set up the startup task, firewall
; rule and nightly backup. Python is bundled, so no internet is needed.
; Cake Studio's own files live in C:\ProgramData\CakeStudio.

#define AppName "Cake Studio"
#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#define BuildDir "build"
#define PS "{sys}\WindowsPowerShell\v1.0\powershell.exe"

[Setup]
AppId={{8D3F2B6A-4C1E-4F7A-9B2D-CA5E57D10001}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=Cake Studio
DefaultDirName={autopf}\Cake Studio
DefaultGroupName=Cake Studio
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=output
OutputBaseFilename=CakeStudio-Setup-{#AppVersion}
SetupIconFile=assets\cakestudio.ico
UninstallDisplayIcon={app}\tools\cakestudio.ico
UninstallDisplayName={#AppName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=no
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop icon"; GroupDescription: "Shortcuts:"

[InstallDelete]
; Replace the app code cleanly on updates (Cake Studio's data is in ProgramData / PostgreSQL).
Type: filesandordirs; Name: "{app}\app"

[Files]
Source: "{#BuildDir}\app\*";    DestDir: "{app}\app";    Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#BuildDir}\python\*"; DestDir: "{app}\python"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "files\*";              DestDir: "{app}\tools";  Excludes: "stop-cake-studio.ps1,check-db.ps1"; Flags: ignoreversion
Source: "files\stop-cake-studio.ps1"; Flags: dontcopy
Source: "files\check-db.ps1";         Flags: dontcopy
Source: "assets\cakestudio.ico"; DestDir: "{app}\tools"; Flags: ignoreversion

[Icons]
Name: "{group}\Cake Studio";           Filename: "{sys}\wscript.exe"; Parameters: """{app}\tools\open-cake-studio.vbs"""; IconFilename: "{app}\tools\cakestudio.ico"
Name: "{autodesktop}\Cake Studio";     Filename: "{sys}\wscript.exe"; Parameters: """{app}\tools\open-cake-studio.vbs"""; IconFilename: "{app}\tools\cakestudio.ico"; Tasks: desktopicon
Name: "{group}\Back up now";           Filename: "{#PS}"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\tools\backup.ps1"""; IconFilename: "{app}\tools\cakestudio.ico"
Name: "{group}\Backups folder";        Filename: "{commonappdata}\CakeStudio\backups"
Name: "{group}\Uninstall Cake Studio"; Filename: "{uninstallexe}"

[Run]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\tools\open-cake-studio.vbs"""; Description: "Open Cake Studio now"; Flags: postinstall nowait skipifsilent

[Code]
var
  DbPage: TInputQueryWizardPage;
  SettingsPage: TInputQueryWizardPage;
  LocalUrl, TabletUrl, StartedEmpty: String;
  PgBinDir: String;

function DataDir(): String;
begin
  Result := ExpandConstant('{commonappdata}\CakeStudio');
end;

// An update = a previous install that SUCCEEDED. After a failed attempt the
// database page is shown again so the details can be corrected.
function IsUpdate(): Boolean;
var Lines: TArrayOfString;
begin
  Result := LoadStringsFromFile(DataDir() + '\config\install-result.txt', Lines) and
            (GetArrayLength(Lines) > 0) and (Lines[0] = 'OK') and
            FileExists(DataDir() + '\config\cakestudio.env');
end;

function DigitsOf(S: String): Integer;
var I: Integer; D: String;
begin
  D := '';
  for I := 1 to Length(S) do
    if (S[I] >= '0') and (S[I] <= '9') then D := D + S[I];
  Result := StrToIntDef(D, 0);
end;

// PostgreSQL's tools (for checking the connection and nightly backups):
// the newest version installed with the official installer.
function FindPostgresBin(): String;
var Names: TArrayOfString; I, Best: Integer; Base: String; Rec: TFindRec;
begin
  Result := ''; Best := -1;
  if RegGetSubkeyNames(HKLM64, 'SOFTWARE\PostgreSQL\Installations', Names) then
    for I := 0 to GetArrayLength(Names) - 1 do
      if RegQueryStringValue(HKLM64, 'SOFTWARE\PostgreSQL\Installations\' + Names[I], 'Base Directory', Base) and
         FileExists(AddBackslash(Base) + 'bin\psql.exe') and (DigitsOf(Names[I]) > Best) then begin
        Best := DigitsOf(Names[I]); Result := AddBackslash(Base) + 'bin';
      end;
  if Result = '' then
    if FindFirst(ExpandConstant('{commonpf64}\PostgreSQL\*'), Rec) then begin
      try
        repeat
          if FileExists(ExpandConstant('{commonpf64}\PostgreSQL\') + Rec.Name + '\bin\psql.exe') and (DigitsOf(Rec.Name) > Best) then begin
            Best := DigitsOf(Rec.Name); Result := ExpandConstant('{commonpf64}\PostgreSQL\') + Rec.Name + '\bin';
          end;
        until not FindNext(Rec);
      finally
        FindClose(Rec);
      end;
    end;
end;

procedure InitializeWizard();
begin
  PgBinDir := FindPostgresBin();
  DbPage := CreateInputQueryPage(wpSelectDir,
    'Database connection',
    'The PostgreSQL database you restored your Cake Studio backup into.',
    'Use the user that restored the backup (usually postgres), so Cake Studio can update its tables. ' +
    'The connection is checked when you click Next.');
  DbPage.Add('Server:', False);
  DbPage.Add('Port:', False);
  DbPage.Add('Database name:', False);
  DbPage.Add('User:', False);
  DbPage.Add('Password:', True);
  DbPage.Values[0] := 'localhost';
  DbPage.Values[1] := '5432';
  DbPage.Values[2] := 'cake_studio';
  DbPage.Values[3] := 'postgres';

  SettingsPage := CreateInputQueryPage(DbPage.ID,
    'Shop settings', 'You can change the time zone later under Organization.',
    'Leave the port as 8000 unless another program already uses it.');
  SettingsPage.Add('Time zone:', False);
  SettingsPage.Add('Port:', False);
  SettingsPage.Values[0] := 'Asia/Karachi';
  SettingsPage.Values[1] := '8000';
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  // An update keeps the existing connection and settings.
  Result := IsUpdate() and ((PageID = DbPage.ID) or (PageID = SettingsPage.ID));
end;

// Returns the check's exit code: 0 OK, 5 empty database, 6 can't test, others = problem.
function CheckDatabase(var Msg: String): Integer;
var Code: Integer; PwFile, OutFile, Saved: String; Pw, Answer: TArrayOfString;
begin
  ExtractTemporaryFile('check-db.ps1');
  PwFile := ExpandConstant('{tmp}\db-check.txt'); OutFile := ExpandConstant('{tmp}\db-check-result.txt');
  SetArrayLength(Pw, 1); Pw[0] := DbPage.Values[4];
  SaveStringsToUTF8File(PwFile, Pw, False);
  DeleteFile(OutFile);
  WizardForm.NextButton.Enabled := False;
  WizardForm.BackButton.Enabled := False;
  Saved := WizardForm.PageDescriptionLabel.Caption;
  WizardForm.PageDescriptionLabel.Caption := 'Checking the database connection... (up to 30 seconds)';
  WizardForm.Refresh;
  Exec(ExpandConstant('{#PS}'), '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\check-db.ps1') +
       '" -PgBin "' + PgBinDir + '" -DbHost "' + Trim(DbPage.Values[0]) + '" -Port ' + Trim(DbPage.Values[1]) +
       ' -Database "' + Trim(DbPage.Values[2]) + '" -User "' + Trim(DbPage.Values[3]) + '"' +
       ' -PasswordFile "' + PwFile + '" -Out "' + OutFile + '"', '', SW_HIDE, ewWaitUntilTerminated, Code);
  WizardForm.NextButton.Enabled := True;
  WizardForm.BackButton.Enabled := True;
  WizardForm.PageDescriptionLabel.Caption := Saved;
  DeleteFile(PwFile);
  Msg := 'The connection check didn''t run.';
  if LoadStringsFromFile(OutFile, Answer) and (GetArrayLength(Answer) > 0) then Msg := Answer[0];
  Result := Code;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var Code, PortNum: Integer; Msg: String;
begin
  Result := True;
  if CurPageID = DbPage.ID then begin
    PortNum := StrToIntDef(Trim(DbPage.Values[1]), 0);
    if (Trim(DbPage.Values[0]) = '') or (PortNum < 1) or (PortNum > 65535) then begin
      MsgBox('Please enter the server (usually localhost) and port (usually 5432).', mbError, MB_OK); Result := False; Exit; end;
    if (Trim(DbPage.Values[2]) = '') or (Trim(DbPage.Values[3]) = '') or (DbPage.Values[4] = '') then begin
      MsgBox('Please enter the database name, user and password.', mbError, MB_OK); Result := False; Exit; end;
    Code := CheckDatabase(Msg);
    if Code = 0 then Exit;
    if Code = 5 then begin
      Result := MsgBox(Msg + #13#10#13#10 + 'Continue with an empty database?', mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES;
      Exit;
    end;
    if Code = 6 then begin
      Result := MsgBox(Msg + #13#10#13#10 + 'Continue anyway?', mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES;
      Exit;
    end;
    MsgBox(Msg + #13#10#13#10 + 'Details of the check: ' + ExpandConstant('{%TEMP}') + '\cakestudio-db-check.log', mbError, MB_OK);
    Result := False;
  end;
  if CurPageID = SettingsPage.ID then begin
    if Trim(SettingsPage.Values[0]) = '' then begin MsgBox('Please enter a time zone, e.g. Asia/Karachi.', mbError, MB_OK); Result := False; Exit; end;
    PortNum := StrToIntDef(Trim(SettingsPage.Values[1]), 0);
    if (PortNum < 1) or (PortNum > 65535) then begin MsgBox('The port must be a number between 1 and 65535.', mbError, MB_OK); Result := False; Exit; end;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var Code: Integer;
begin
  Result := '';
  // Stop a running Cake Studio so its files can be replaced.
  ExtractTemporaryFile('stop-cake-studio.ps1');
  Exec(ExpandConstant('{#PS}'), '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\stop-cake-studio.ps1') + '"',
       '', SW_HIDE, ewWaitUntilTerminated, Code);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var Code: Integer; Args, PwFile: String; Lines, Pw: TArrayOfString;
begin
  if CurStep <> ssPostInstall then Exit;
  WizardForm.StatusLabel.Caption := 'Connecting Cake Studio to the database and starting it. This takes a minute or two...';
  Args := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\tools\setup.ps1') + '"';
  if IsUpdate() then begin
    if LoadStringsFromFile(DataDir() + '\config\port.txt', Lines) and (GetArrayLength(Lines) > 0) then
      Args := Args + ' -Port ' + Trim(Lines[0]);
  end else begin
    // The database password goes in a temporary file that setup.ps1 deletes after reading.
    PwFile := ExpandConstant('{tmp}\db-password.txt');
    SetArrayLength(Pw, 1); Pw[0] := DbPage.Values[4];
    SaveStringsToUTF8File(PwFile, Pw, False);
    Args := Args + ' -DbHost "' + Trim(DbPage.Values[0]) + '" -DbPort ' + Trim(DbPage.Values[1]) +
                   ' -DbName "' + Trim(DbPage.Values[2]) + '" -DbUser "' + Trim(DbPage.Values[3]) + '"' +
                   ' -DbPasswordFile "' + PwFile + '" -PgBin "' + PgBinDir + '"' +
                   ' -Port ' + Trim(SettingsPage.Values[1]) + ' -TimeZone "' + Trim(SettingsPage.Values[0]) + '"';
  end;
  DeleteFile(DataDir() + '\config\install-result.txt');   // never read a previous run's result
  Exec(ExpandConstant('{#PS}'), Args, '', SW_HIDE, ewWaitUntilTerminated, Code);
  DeleteFile(ExpandConstant('{tmp}\db-password.txt'));

  if LoadStringsFromFile(DataDir() + '\config\install-result.txt', Lines) and (GetArrayLength(Lines) >= 3) and (Lines[0] = 'OK') then begin
    LocalUrl := Lines[1]; TabletUrl := Lines[2];
    if GetArrayLength(Lines) >= 4 then StartedEmpty := Lines[3];
  end else if GetArrayLength(Lines) >= 3 then
    MsgBox('Cake Studio was copied, but connecting it failed:' + #13#10#13#10 + Lines[1] + #13#10#13#10 +
           'Details: ' + Lines[2] + #13#10#13#10 + 'Fix the problem and run the installer again - it will ask for the database details again.', mbError, MB_OK)
  else
    MsgBox('Cake Studio was copied, but the setup step didn''t report back. See ' + DataDir() + '\logs', mbError, MB_OK);
end;

procedure CurPageChanged(CurPageID: Integer);
var Extra: String;
begin
  if (CurPageID = wpFinished) and (TabletUrl <> '') then begin
    Extra := '';
    if StartedEmpty = 'EMPTY' then
      Extra := #13#10#13#10 + 'The database was empty, so a starter login was created: owner@cakestudio.local / change-me. Sign in and change that password straight away.';
    WizardForm.FinishedLabel.Caption :=
      'Cake Studio is installed and running.' + #13#10#13#10 +
      'On this PC: use the Cake Studio icon, or ' + LocalUrl + #13#10 +
      'Tablets and phones on the shop Wi-Fi: ' + TabletUrl + Extra + #13#10#13#10 +
      'Tip: in the Wi-Fi router, give this PC a fixed IP so that address never changes, and set this PC to never sleep.';
  end;
end;

// ----------------------------------------------------------------- uninstall
var DeleteData: Boolean;

function InitializeUninstall(): Boolean;
begin
  Result := True;
  DeleteData := MsgBox('Also remove Cake Studio''s files on this PC (settings, logo, logs and backups in C:\ProgramData\CakeStudio)?' + #13#10#13#10 +
    'Your PostgreSQL database is never deleted either way.' + #13#10#13#10 +
    'No - keep them (recommended). Yes - remove them (a final backup is saved to Documents first).',
    mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var Code: Integer; Args: String;
begin
  if CurUninstallStep = usUninstall then begin
    Args := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\tools\uninstall.ps1') + '"';
    if DeleteData then Args := Args + ' -DeleteData';
    Exec(ExpandConstant('{#PS}'), Args, '', SW_HIDE, ewWaitUntilTerminated, Code);
  end;
end;
