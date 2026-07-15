"""PySide6 tray interface for BotForge Runner beta."""

from __future__ import annotations

import argparse
import sys
import threading
import webbrowser

from PySide6.QtCore import QObject, Signal
from PySide6.QtGui import QAction, QIcon
from PySide6.QtWidgets import (
    QApplication, QHBoxLayout, QLabel, QMainWindow, QMessageBox,
    QPushButton, QStyle, QSystemTrayIcon, QTextEdit, QVBoxLayout, QWidget,
)

from pairing import token_from_installer_name
from windows_runner import DEFAULT_SERVER, Runner, VERSION

DOCKER_URL = "https://www.docker.com/products/docker-desktop/"


class Bridge(QObject):
    state = Signal(str, str)
    log = Signal(str)


class RunnerWindow(QMainWindow):
    def __init__(self, pairing_token: str | None, server_url: str):
        super().__init__()
        self.setWindowTitle(f"BotForge Runner {VERSION}")
        self.resize(620, 430)
        self.bridge = Bridge()
        self.bridge.state.connect(self.set_state)
        self.bridge.log.connect(self.append_log)
        self.runner = Runner(self.bridge.state.emit, self.bridge.log.emit)

        self.status = QLabel("Подготовка…")
        self.status.setStyleSheet("font-size: 18px; font-weight: 600;")
        self.detail = QLabel("Проверяем подключение и Docker Desktop")
        self.detail.setWordWrap(True)
        self.logs = QTextEdit()
        self.logs.setReadOnly(True)
        self.logs.setPlaceholderText("Безопасные логи раннера появятся здесь")
        self.pause_button = QPushButton("Пауза")
        self.pause_button.clicked.connect(self.toggle_pause)
        self.cancel_button = QPushButton("Остановить текущий бот")
        self.cancel_button.clicked.connect(self.runner.cancel_current)
        docker_button = QPushButton("Установить Docker Desktop")
        docker_button.clicked.connect(lambda: webbrowser.open(DOCKER_URL))
        dashboard_button = QPushButton("Открыть BotForge")
        dashboard_button.clicked.connect(lambda: webbrowser.open(server_url))

        actions = QHBoxLayout()
        for button in (self.pause_button, self.cancel_button, docker_button, dashboard_button):
            actions.addWidget(button)
        layout = QVBoxLayout()
        layout.addWidget(self.status)
        layout.addWidget(self.detail)
        layout.addLayout(actions)
        layout.addWidget(self.logs)
        container = QWidget()
        container.setLayout(layout)
        self.setCentralWidget(container)

        icon = self.style().standardIcon(QStyle.StandardPixmap.SP_ComputerIcon)
        self.setWindowIcon(icon)
        self.tray = QSystemTrayIcon(icon, self)
        menu = self.tray.contextMenu() or __import__("PySide6.QtWidgets", fromlist=["QMenu"]).QMenu()
        show_action = QAction("Открыть BotForge Runner", self)
        show_action.triggered.connect(self.showNormal)
        pause_action = QAction("Пауза / продолжить", self)
        pause_action.triggered.connect(self.toggle_pause)
        exit_action = QAction("Выход", self)
        exit_action.triggered.connect(self.exit_runner)
        menu.addAction(show_action)
        menu.addAction(pause_action)
        menu.addSeparator()
        menu.addAction(exit_action)
        self.tray.setContextMenu(menu)
        self.tray.activated.connect(lambda reason: self.showNormal() if reason == QSystemTrayIcon.ActivationReason.DoubleClick else None)
        self.tray.show()

        if pairing_token:
            try:
                self.runner.pair(pairing_token, server_url)
            except Exception as exc:
                QMessageBox.critical(self, "Не удалось подключить", str(exc))
        self.worker = threading.Thread(target=self.runner.run_forever, daemon=True)
        self.worker.start()

    def set_state(self, state: str, detail: str) -> None:
        labels = {
            "online": "Онлайн — можно запускать бота",
            "running": "Бот выполняется",
            "paused": "Раннер на паузе",
            "offline": "Нет связи",
            "unpaired": "Раннер не подключён",
            "docker_required": "Нужен Docker Desktop",
            "connecting": "Подключение",
        }
        self.status.setText(labels.get(state, state))
        self.detail.setText(detail)
        self.cancel_button.setEnabled(state == "running")

    def append_log(self, text: str) -> None:
        self.logs.append(text[:2_000])

    def toggle_pause(self) -> None:
        self.runner.pause(not self.runner.paused)
        self.pause_button.setText("Продолжить" if self.runner.paused else "Пауза")

    def closeEvent(self, event) -> None:  # noqa: N802
        event.ignore()
        self.hide()
        self.tray.showMessage("BotForge Runner", "Раннер продолжает работать в фоне.")

    def exit_runner(self) -> None:
        if QMessageBox.question(self, "Выйти из раннера", "Текущий бот будет остановлен. Выйти?") == QMessageBox.StandardButton.Yes:
            self.runner.stop()
            QApplication.quit()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pair-token")
    parser.add_argument("--server-url", default=DEFAULT_SERVER)
    args = parser.parse_args()
    token = args.pair_token or token_from_installer_name(sys.argv[0])
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)
    window = RunnerWindow(token, args.server_url.rstrip("/"))
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
