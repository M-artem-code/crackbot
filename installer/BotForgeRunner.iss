#define MyAppName "BotForge Runner Beta"
#define MyAppVersion "0.1.0-beta.5"
#define MyAppExeName "BotForgeRunner.exe"
#ifndef AppServerUrl
  #define AppServerUrl "https://botforge.example"
#endif

[Setup]
AppId={{B8D87789-69A5-4D89-A8E1-D5D4DB88B0AF}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={localappdata}\Programs\BotForge Runner
DefaultGroupName=BotForge Runner
OutputDir=output
OutputBaseFilename=BotForgeRunner-Setup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}
WizardStyle=modern

[Files]
Source: "..\agent\dist\BotForgeRunner\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\BotForge Runner"; Filename: "{app}\{#MyAppExeName}"
Name: "{userstartup}\BotForge Runner"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--server-url {#AppServerUrl}"; WorkingDir: "{app}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Parameters: "{code:RunnerArguments}"; Description: "Запустить BotForge Runner"; Flags: nowait postinstall skipifsilent

[Code]
var
  PairToken: String;
  PairingPage: TInputQueryWizardPage;

function ExtractPairToken(): String;
var
  Name: String;
  StartPos: Integer;
begin
  Name := ExtractFileName(ExpandConstant('{srcexe}'));
  StartPos := Pos('pair_', Name);
  if StartPos > 0 then
    Result := Copy(Name, StartPos, Length(Name) - StartPos - 3)
  else
    Result := '';
end;

function IsValidPairToken(const Token: String): Boolean;
begin
  Result := (Length(Token) >= 45) and (Length(Token) <= 65) and (Copy(Token, 1, 5) = 'pair_');
end;

procedure InitializeWizard();
begin
  PairToken := ExtractPairToken();
  if not IsValidPairToken(PairToken) then
  begin
    PairingPage := CreateInputQueryPage(
      wpWelcome,
      'Подключение к BotForge',
      'Введите одноразовый код подключения',
      'Создайте агента в BotForge, скопируйте код подключения и вставьте его ниже. Код действует 10 минут и используется только один раз.'
    );
    PairingPage.Add('Код подключения:', False);
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (PairingPage <> nil) and (CurPageID = PairingPage.ID) then
  begin
    PairToken := Trim(PairingPage.Values[0]);
    Result := IsValidPairToken(PairToken);
    if not Result then
      MsgBox('Некорректный код. Скопируйте новый одноразовый код на странице «Агенты» в BotForge.', mbError, MB_OK);
  end;
end;

function RunnerArguments(Param: String): String;
begin
  Result := '--pair-token "' + PairToken + '" --server-url "{#AppServerUrl}"';
end;
