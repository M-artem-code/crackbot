# crackbot agent

Headless-раннер на Python. Подключается к дашборду crackbot, забирает задания
(прогоны ботов), выполняет сценарий OTP-регистрации через `nodriver` + stealth и
отправляет результаты обратно на сервер.

Реф-пул, лимиты успехов и счётчики полностью ведёт сервер — локального
`ref_links.json` больше нет. Агент получает реф в каждом задании и возвращает
`refId` со счётчиками в `/complete`.

## Установка

```bash
cd agent
python -m venv .venv && source .venv/bin/activate   # опционально
pip install -r requirements.txt
```

`nodriver` требует установленного Chrome/Chromium.

## Настройка

1. Откройте дашборд → страница **Агенты** → создайте агента.
2. Нажмите **Скачать конфиг** — получите `agent-config-<имя>.json`.
3. Положите его рядом со скриптом под именем `agent-config.json`:

```json
{
  "server_url": "https://ваш-дашборд.vercel.app",
  "api_key": "agt_...",
  "poll_interval_sec": 5,
  "headless": true,
  "proxy": null
}
```

Параметры можно переопределить переменными окружения:
`CRACKBOT_SERVER_URL`, `CRACKBOT_API_KEY`, `CRACKBOT_POLL_INTERVAL`,
`CRACKBOT_PROXY`, `CRACKBOT_HEADLESS`.

## Запуск

```bash
python agent.py            # постоянный цикл: heartbeat + опрос заданий
python agent.py --once     # выполнить одно задание и выйти
python agent.py --config /path/to/agent-config.json
```

Docker-образ включает Chrome, Python-зависимости и запускается от непривилегированного пользователя:

```bash
docker build -f agent/Dockerfile.nodriver -t crackbot-agent agent
docker run --rm --shm-size=2g \
  -e CRACKBOT_SERVER_URL=https://your-dashboard.vercel.app \
  -e CRACKBOT_API_KEY=agt_your_key \
  crackbot-agent
```

После старта агент появится как **Онлайн** в дашборде, а шаги каждого прогона
будут стримиться в логи в реальном времени.

## Как это работает

| Эндпоинт | Назначение |
| --- | --- |
| `POST /api/agent/heartbeat` | держит агента онлайн + сообщает ОС |
| `GET /api/agent/jobs` | атомарно захватывает один `queued`-прогон |
| `POST /api/agent/runs/{id}/steps` | стрим шагов лога |
| `POST /api/agent/runs/{id}/complete` | итог: статус, счётчики, `refId` |

## Файлы

| Файл | Назначение |
| --- | --- |
| `agent.py` | точка входа, главный цикл, heartbeat |
| `api_client.py` | HTTP-клиент сервера + буфер шагов |
| `runner.py` | движок сценария OTP-регистрации |
| `browser.py` | запуск `nodriver` + stealth + прокси |
| `mail_client.py` | клиент TempMail.World (получение кода) |
| `stealth.js` | антидетект-патчи, инжектятся в каждую страницу |
| `config.py` | загрузка `agent-config.json` |

## Параметры сценария

Берутся из `template.defaultConfig`, переопределяются `bot.config`:

| Ключ | По умолчанию | Значение |
| --- | --- | --- |
| `page_timeout` | 45 | таймаут поиска элементов, сек |
| `otp_timeout` | 120 | ожидание кода из почты, сек |
| `action_delay_min` / `action_delay_max` | 0.4 / 1.4 | задержки между действиями, сек |
| `runtimePassword` | — | расшифрованный сервером пароль только для текущего задания |
| `runtimeProxy` | — | проверенный пользовательский или бесплатный прокси только для текущего задания |
| `allowDirectFallback` | false | разрешить прямую сеть агента, если прокси недоступны |
| `headless` | true | запуск браузера без окна |

Число воркеров берётся из `bot.workers`.
