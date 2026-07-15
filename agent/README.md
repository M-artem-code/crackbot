# BotForge Windows Runner beta

Windows 10/11 tray-приложение, которое получает опубликованный `bot.py` из BotForge и запускает его только внутри Docker Desktop. Закрытие окна сворачивает раннер в tray; после входа пользователя в Windows он запускается автоматически.

## Пользовательский путь

1. В BotForge откройте **Агенты → Новый агент**.
2. Установите и запустите Docker Desktop.
3. Скачайте персональный setup в течение 10 минут.
4. Запустите setup и подтвердите предупреждение SmartScreen для unsigned beta.
5. Дождитесь статуса агента **Онлайн**.
6. Опубликуйте `bot.py`, создайте прогон и выберите онлайн-агента.

Setup содержит одноразовый pairing-токен только в имени скачанного файла. При первом запуске он обменивается на ключ агента, после чего токен становится недействительным, а ключ хранится в Windows Credential Manager.

Начиная с `0.1.0-beta.6`, для смены агента не нужно повторно устанавливать Runner. Создайте новый одноразовый код в BotForge, затем в окне Runner или его меню в системном трее выберите **«Переподключить агента»** и вставьте код. Новый API-ключ заменит старый только после успешной проверки кода.

## Гарантии beta

- Пользовательский Python никогда не запускается непосредственно на Windows host.
- Контейнер: 1 CPU, 512 MB RAM, 256 PID, read-only root, без Linux capabilities и без Docker socket/host mounts.
- Один bot одновременно, максимум 15 минут и 1 MB вывода.
- Интернет контейнера включён; доступ к интернет-сервисам нельзя считать доверенным.
- Поддерживаются только опубликованные `bot.py` и зависимости из allowlist с точной версией.
- Постоянные права администратора раннеру и bot.py не выдаются.

## Локальная проверка runner core

```bash
cd agent
python -m unittest test_windows_runner.py
```

## Windows build

Workflow `.github/workflows/windows-runner.yml` собирает PyInstaller executable и per-user Inno Setup. Перед запуском workflow задайте GitHub repository variable `BOTFORGE_SERVER_URL` с HTTPS-адресом production-приложения. После публикации setup задайте приложению `RUNNER_INSTALLER_URL` — прямой HTTPS URL файла `BotForgeRunner-Setup.exe`.

Tagged build `runner-v*` создаёт prerelease и checksum. Beta остаётся неподписанной; перед production нужен code-signing сертификат и проверка подписи в release pipeline.

## Основные файлы

| Файл | Назначение |
| --- | --- |
| `tray_app.py` | окно и Windows tray |
| `windows_runner.py` | heartbeat, job loop, cancel и lease monitor |
| `docker_executor.py` | Docker sandbox и resource limits |
| `dependency_policy.py` | allowlist `requirements.txt` |
| `credential_store.py` | Windows Credential Manager |
| `pairing.py` | одноразовая привязка |
| `BotForgeRunner.spec` | PyInstaller build |
| `installer.iss` | per-user setup и автозапуск |
