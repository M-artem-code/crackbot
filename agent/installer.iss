#define AppName "BotForge Runner"
#define AppVersion "0.1.0-beta.1"
#define AppExeName "BotForgeRunner.exe"
#ifndef SERVER_URL
  #define SERVER_URL "http://localhost:3000"
#endif

[Setup]
AppId={{8B918D85-2744-4A83-BEA4-447516BF26D2}
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\BotForge Runner
DefaultGroupName=BotForge Runner
OutputDir=dist-installer
OutputBaseFilename=BotForgeRunner-Setup
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
Compression=lzma2
SolidCompression=yes
UninstallDisplayIcon={app}\{#AppExeName}
WizardStyle=modern

[Files]
Source: "dist\BotForgeRunner.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\BotForge Runner"; Filename: "{app}\{#AppExeName}"
Name: "{userstartup}\BotForge Runner"; Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"

[Run]
Filename: "{app}\{#AppExeName}"; Parameters: "{code:GetPairingParams}"; Description: "Запустить BotForge Runner"; Flags: nowait postinstall skipifsilent

[Code]
function GetPairingParams(Param: String): String;
var
  SourceName: String;
  PairPos: Integer;
  Token: String;
begin
  SourceName := ExtractFileName(ExpandConstant('{srcexe}'));
  PairPos := Pos('pair_', SourceName);
  if PairPos > 0 then begin
    Token := Copy(SourceName, PairPos, Length(SourceName) - PairPos - 3);
    Result := '--pair-token "' + Token + '" --server-url "{#SERVER_URL}"';
  end else
    Result := '--server-url "{#SERVER_URL}"';
end;
