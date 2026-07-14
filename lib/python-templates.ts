const commonHeader = `"""Crackbot user script.
Input: CRACKBOT_INPUT points to a JSON job file.
Output: print one JSON object with success, message and artifacts.
This file runs inside an isolated disposable container.
"""
import asyncio
import json
import os
from pathlib import Path

from playwright.async_api import async_playwright

JOB = json.loads(Path(os.environ["CRACKBOT_INPUT"]).read_text())
`

const v0Body = `
async def main():
    target = JOB["target"]
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(target["url"], wait_until="domcontentloaded")
        # Edit selectors and registration logic for your v0 deployment here.
        title = await page.title()
        await page.screenshot(path="/workspace/artifacts/result.png", full_page=True)
        await browser.close()
    print(json.dumps({"success": True, "message": f"Opened v0 page: {title}", "artifacts": ["result.png"]}))

asyncio.run(main())
`

const adflexBody = `
async def main():
    target = JOB["target"]
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(target["url"], wait_until="networkidle")
        # Edit selectors, form fields and success conditions for AdFlex here.
        title = await page.title()
        await page.screenshot(path="/workspace/artifacts/result.png", full_page=True)
        await browser.close()
    print(json.dumps({"success": True, "message": f"Opened AdFlex page: {title}", "artifacts": ["result.png"]}))

asyncio.run(main())
`

export const DEFAULT_PYTHON_REQUIREMENTS = 'playwright==1.55.0\n'

export function pythonTemplateFor(slug: string) {
  return commonHeader + (slug === 'adflex' ? adflexBody : v0Body)
}
