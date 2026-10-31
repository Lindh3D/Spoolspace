#ifndef AppVersion
  #define AppVersion "0.5.3"
#endif
#ifndef StageDir
  #error StageDir must point to the verified application bundle
#endif
#ifndef ReleaseDir
  #error ReleaseDir must point to the output directory
#endif
[Setup]
AppId=Spoolspace.FilamentInventory
AppName=Spoolspace
AppVersion={#AppVersion}
AppPublisher=Spoolspace contributors
DefaultDirName={autopf}\Spoolspace
DefaultGroupName=Spoolspace
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern
LicenseFile=..\..\LICENSE
SetupIconFile=Spoolspace.ico
UninstallDisplayIcon={app}\Spoolspace.exe
OutputDir={#ReleaseDir}
OutputBaseFilename=Spoolspace-Setup-{#AppVersion}-win-x64
Compression=lzma2/normal
SolidCompression=yes
AppMutex=Local\Spoolspace.Launcher
CloseApplications=yes
RestartApplications=no
DisableProgramGroupPage=yes
VersionInfoDescription=Spoolspace filament inventory installer

[Languages]
Name: english; MessagesFile: compiler:Default.isl
Name: swedish; MessagesFile: compiler:Languages\Swedish.isl

[CustomMessages]
english.DesktopIcon=Create a desktop shortcut
swedish.DesktopIcon=Skapa en genväg på skrivbordet
english.Firewall=Allow phones on the private local network (Windows Firewall)
swedish.Firewall=Tillåt telefoner på det privata lokala nätverket (Windows-brandväggen)
english.StartTitle=Server startup
swedish.StartTitle=Start av servern
english.StartDescription=Choose how Spoolspace starts on this computer.
swedish.StartDescription=Välj hur Spoolspace ska starta på datorn.
english.StartDetail=The service option runs without anyone signing in. Inventory is kept separately from application files and is preserved during upgrades and uninstall.
swedish.StartDetail=Tjänsteläget kör utan att någon behöver logga in. Databasen lagras separat från programfilerna och behålls vid uppdatering och avinstallation.
english.ManualStart=Start when I open the desktop shortcut
swedish.ManualStart=Starta när jag öppnar skrivbordsgenvägen
english.LoginStart=Start in the background at Windows sign-in
swedish.LoginStart=Starta i bakgrunden vid Windows-inloggning
english.ServiceStart=Run as a Windows service at computer startup (home server)
swedish.ServiceStart=Kör som Windows-tjänst vid datorstart (hemmaserver)
english.OpenApp=Open Spoolspace
swedish.OpenApp=Öppna Spoolspace

[Tasks]
Name: desktopicon; Description: {cm:DesktopIcon}
Name: firewall; Description: {cm:Firewall}

[Files]
Source: "{#StageDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Dirs]
Name: "{commonappdata}\Spoolspace"; Permissions: users-modify; Flags: uninsneveruninstall

[Icons]
Name: "{group}\Spoolspace"; Filename: "{app}\Spoolspace.exe"; WorkingDir: "{app}"
Name: "{group}\Spoolspace Windows startup settings"; Filename: "{app}\Spoolspace.exe"; Parameters: "spoolspace://startup"; WorkingDir: "{app}"
Name: "{autodesktop}\Spoolspace"; Filename: "{app}\Spoolspace.exe"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{group}\Uninstall Spoolspace"; Filename: "{uninstallexe}"

[Registry]
Root: HKLM; Subkey: "Software\Spoolspace"; ValueType: string; ValueName: "InstallDir"; ValueData: "{app}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Classes\spoolspace"; ValueType: string; ValueData: "URL:Spoolspace settings"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Classes\spoolspace"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKLM; Subkey: "Software\Classes\spoolspace\shell\open\command"; ValueType: string; ValueData: """{app}\Spoolspace.exe"" ""%1"""

[Run]
Filename: "{app}\Spoolspace.exe"; Description: "{cm:OpenApp}"; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent runasoriginaluser

[Code]
type
  TServiceStatus = record
    ServiceType, CurrentState, ControlsAccepted, Win32ExitCode,
    ServiceSpecificExitCode, CheckPoint, WaitHint: LongWord;
  end;
function OpenSCManager(MachineName, DatabaseName: String; Access: LongWord): THandle;
  external 'OpenSCManagerW@advapi32.dll stdcall';
function OpenService(Manager: THandle; Name: String; Access: LongWord): THandle;
  external 'OpenServiceW@advapi32.dll stdcall';
function ControlService(Service: THandle; Control: LongWord; var Status: TServiceStatus): Boolean;
  external 'ControlService@advapi32.dll stdcall';
function QueryServiceStatus(Service: THandle; var Status: TServiceStatus): Boolean;
  external 'QueryServiceStatus@advapi32.dll stdcall';
function CloseServiceHandle(Handle: THandle): Boolean;
  external 'CloseServiceHandle@advapi32.dll stdcall';

var StartPage: TInputOptionWizardPage;

function ExistingService: Boolean;
begin
  Result := RegKeyExists(HKLM, 'SYSTEM\CurrentControlSet\Services\Spoolspace');
end;

function OwnService: Boolean;
var ImagePath, InstalledPath: String;
begin
  Result := False;
  if not RegQueryStringValue(HKLM, 'SYSTEM\CurrentControlSet\Services\Spoolspace', 'ImagePath', ImagePath) then exit;
  if not RegQueryStringValue(HKLM, 'Software\Spoolspace', 'InstallDir', InstalledPath) then InstalledPath := ExpandConstant('{app}');
  Result := Pos(Lowercase('"' + InstalledPath + '\Spoolspace.exe" --service'), Lowercase(ImagePath)) = 1;
end;

procedure StopOwnService;
var Manager, Service: THandle; Status: TServiceStatus; Attempts: Integer;
begin
  if not OwnService then exit;
  Manager := OpenSCManager('', 'ServicesActive', 1);
  if Manager = 0 then RaiseException('Could not open the Windows Service Manager.');
  Service := OpenService(Manager, 'Spoolspace', $0024);
  if Service <> 0 then begin
    if QueryServiceStatus(Service, Status) and (Status.CurrentState <> 1) then begin
      ControlService(Service, 1, Status);
      Attempts := 0;
      while QueryServiceStatus(Service, Status) and (Status.CurrentState <> 1) and (Attempts < 100) do begin Sleep(250); Attempts := Attempts + 1; end;
      if Status.CurrentState <> 1 then RaiseException('Spoolspace service did not stop. Close it in Windows Services and retry.');
    end;
    CloseServiceHandle(Service);
  end;
  CloseServiceHandle(Manager);
end;

procedure RunTool(FileName, Parameters: String; Required: Boolean);
var Code: Integer;
begin
  if not Exec(FileName, Parameters, '', SW_HIDE, ewWaitUntilTerminated, Code) or (Code <> 0) then
    if Required then RaiseException('Could not configure Spoolspace: ' + ExtractFileName(FileName) + ' (exit ' + IntToStr(Code) + ').');
end;

procedure InitializeWizard;
var Previous: Cardinal; Choice: String;
begin
  StartPage := CreateInputOptionPage(wpSelectTasks, ExpandConstant('{cm:StartTitle}'), ExpandConstant('{cm:StartDescription}'), ExpandConstant('{cm:StartDetail}'), True, False);
  StartPage.Add(ExpandConstant('{cm:ManualStart}'));
  StartPage.Add(ExpandConstant('{cm:LoginStart}'));
  StartPage.Add(ExpandConstant('{cm:ServiceStart}'));
  Previous := 0;
  RegQueryDWordValue(HKLM, 'Software\Spoolspace', 'StartMode', Previous);
  if Previous > 2 then Previous := 0;
  Choice := ExpandConstant('{param:STARTUP|existing}');
  if Choice = 'manual' then Previous := 0;
  if Choice = 'login' then Previous := 1;
  if Choice = 'service' then Previous := 2;
  StartPage.SelectedValueIndex := Previous;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  if ExistingService and not OwnService then begin Result := 'A different service named Spoolspace exists. No service configuration has been changed.'; exit; end;
  StopOwnService;
end;

function JsonPath(Value: String): String;
begin
  StringChangeEx(Value, '\', '\\', True);
  StringChangeEx(Value, '"', '\"', True);
  Result := Value;
end;

procedure CurStepChanged(Step: TSetupStep);
var Configuration, ScExe, NetshExe, DataFolder: String; Lines: TArrayOfString;
begin
  if Step <> ssPostInstall then exit;
  DataFolder := ExpandConstant('{commonappdata}\Spoolspace');
  Configuration := DataFolder + '\config.json';
  if not FileExists(Configuration) then begin
    SetArrayLength(Lines, 1);
    Lines[0] := '{"port":4173,"host":"0.0.0.0","dataDir":"' + JsonPath(DataFolder) + '","httpsPort":4174,"httpsMode":"off","tlsCertFile":"","tlsKeyFile":"","allowedHosts":[]}';
    if not SaveStringsToUTF8File(Configuration, Lines, False) then RaiseException('Could not create server configuration.');
  end;
  RunTool(ExpandConstant('{app}\runtime\node.exe'), '"' + ExpandConstant('{app}\lib\windows-http-default.mjs') + '" "' + Configuration + '"', True);
  ScExe := ExpandConstant('{sys}\sc.exe');
  NetshExe := ExpandConstant('{sys}\netsh.exe');
  RegDeleteValue(HKLM, 'Software\Microsoft\Windows\CurrentVersion\Run', 'Spoolspace');
  if StartPage.SelectedValueIndex = 1 then
    RegWriteStringValue(HKLM, 'Software\Microsoft\Windows\CurrentVersion\Run', 'Spoolspace', '"' + ExpandConstant('{app}\Spoolspace.exe') + '" --background');
  if StartPage.SelectedValueIndex = 2 then begin
    RunTool(ExpandConstant('{sys}\icacls.exe'), '"' + DataFolder + '" /grant "*S-1-5-19:(OI)(CI)M" /T /C', True);
    if ExistingService then
      RunTool(ScExe, 'config Spoolspace binPath= "\"' + ExpandConstant('{app}\Spoolspace.exe') + '\" --service" start= auto obj= "NT AUTHORITY\LocalService"', True)
    else
      RunTool(ScExe, 'create Spoolspace binPath= "\"' + ExpandConstant('{app}\Spoolspace.exe') + '\" --service" start= auto obj= "NT AUTHORITY\LocalService" DisplayName= "Spoolspace filament server"', True);
    RunTool(ScExe, 'description Spoolspace "Local filament inventory and label recognition on your home network."', False);
    RunTool(ScExe, 'failure Spoolspace reset= 86400 actions= restart/5000/restart/15000/restart/60000', False);
    RunTool(ScExe, 'start Spoolspace', True);
  end else if OwnService then RunTool(ScExe, 'delete Spoolspace', True);
  RegWriteDWordValue(HKLM, 'Software\Spoolspace', 'StartMode', StartPage.SelectedValueIndex);
  RunTool(NetshExe, 'advfirewall firewall delete rule name="Spoolspace private LAN" program="' + ExpandConstant('{app}\runtime\node.exe') + '"', False);
  if WizardIsTaskSelected('firewall') then
    RunTool(NetshExe, 'advfirewall firewall add rule name="Spoolspace private LAN" dir=in action=allow program="' + ExpandConstant('{app}\runtime\node.exe') + '" protocol=TCP localport=4173,4174 profile=private remoteip=localsubnet enable=yes', True);
end;

procedure CurUninstallStepChanged(Step: TUninstallStep);
begin
  if Step <> usUninstall then exit;
  if OwnService then begin StopOwnService; RunTool(ExpandConstant('{sys}\sc.exe'), 'delete Spoolspace', True); end;
  RegDeleteValue(HKLM, 'Software\Microsoft\Windows\CurrentVersion\Run', 'Spoolspace');
  RunTool(ExpandConstant('{sys}\netsh.exe'), 'advfirewall firewall delete rule name="Spoolspace private LAN" program="' + ExpandConstant('{app}\runtime\node.exe') + '"', False);
end;
