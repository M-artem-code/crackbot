# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

pyside_data, pyside_bins, pyside_hidden = collect_all('PySide6')
keyring_data, keyring_bins, keyring_hidden = collect_all('keyring')

analysis = Analysis(
    ['tray_app.py'],
    pathex=['.'],
    binaries=pyside_bins + keyring_bins,
    datas=pyside_data + keyring_data,
    hiddenimports=pyside_hidden + keyring_hidden + ['keyring.backends.Windows'],
    noarchive=False,
)
pyz = PYZ(analysis.pure)
exe = EXE(
    pyz,
    analysis.scripts,
    [],
    exclude_binaries=True,
    name='BotForgeRunner',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
)
collect = COLLECT(exe, analysis.binaries, analysis.datas, strip=False, upx=False, name='BotForgeRunner')
