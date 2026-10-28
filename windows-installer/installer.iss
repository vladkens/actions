; A per-user installer: no administrator, always the same folder, so an app's own updater can run
; it silently over an installed copy. The defines come from action.yml.

[Setup]
AppId={{{#AppId}}
AppName={#AppName}
AppVersion={#AppVersion}
VersionInfoVersion={#NumericVersion}
AppPublisher={#Publisher}
AppPublisherURL={#Url}
PrivilegesRequired=lowest
DefaultDirName={userpf}\{#AppName}
DisableDirPage=yes
DisableProgramGroupPage=yes
ArchitecturesAllowed={#Arch}
ArchitecturesInstallIn64BitMode={#Arch}
UninstallDisplayIcon={app}\{#Exe}
UninstallDisplayName={#AppName}
; Restart Manager closes a running copy on an interactive install; nothing is started again.
CloseApplications=yes
RestartApplications=no
OutputDir={#OutputDir}
OutputBaseFilename={#OutputName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Files]
Source: "{#Source}"; DestDir: "{app}"; DestName: "{#Exe}"; Flags: ignoreversion
#ifdef License
Source: "{#License}"; DestDir: "{app}"; DestName: "LICENSE.txt"; Flags: ignoreversion
#endif

[Icons]
Name: "{userprograms}\{#AppName}"; Filename: "{app}\{#Exe}"

; Interactive installs only: a silent one is an update, and the updater starts the app itself.
[Run]
Filename: "{app}\{#Exe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent

#ifdef Autostart
; The app's launch at login, which it writes itself, would point at a removed exe.
[Code]
procedure CurUninstallStepChanged(Step: TUninstallStep);
begin
  if Step = usPostUninstall then begin
    RegDeleteValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', '{#Autostart}');
    RegDeleteValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run', '{#Autostart}');
  end;
end;
#endif
