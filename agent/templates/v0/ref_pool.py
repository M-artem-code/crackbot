import json
from pathlib import Path

BASE_DIR = Path(__file__).parent
POOL_FILE = BASE_DIR / "ref_links.json"
SUCCESS_LIMIT = 40


class RefPool:
    def __init__(self, pool_file: str | Path | None = None):
        self.pool_file = Path(pool_file) if pool_file else POOL_FILE
        self.data = self._load()

    def _load(self):
        if self.pool_file.exists():
            try:
                d = json.loads(self.pool_file.read_text(encoding="utf-8"))
                d.setdefault("last_result_line", 0)
                for link in d.get("links", []):
                    link.setdefault("raw_total_time", link.get("total_time", 0))
                    link.setdefault("batches", {})
                    # if batches exist, recompute total_time = sum of batch averages
                    if link["batches"]:
                        bt = 0.0
                        for durs in link["batches"].values():
                            if durs:
                                bt += sum(durs) / len(durs)
                        link["total_time"] = round(bt, 1)
                    # if no batches yet, keep old total_time (migration)
                    link.setdefault("avg_time", 0)
                    if link["success"] > 0 and link["raw_total_time"] > 0:
                        link["avg_time"] = round(link["raw_total_time"] / link["success"], 1)
                return d
            except Exception:
                pass
        return {
            "active_index": 0,
            "success_limit": SUCCESS_LIMIT,
            "last_result_line": 0,
            "links": [],
        }

    def _save(self):
        tmp = self.pool_file.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(self.data, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(self.pool_file)

    def current_url(self):
        links = self.data["links"]
        idx = self.data["active_index"]
        if 0 <= idx < len(links):
            return links[idx]["url"]
        return None

    def has_active(self):
        return self.current_url() is not None

    def record_result(self, status: str):
        links = self.data["links"]
        idx = self.data["active_index"]
        if idx >= len(links):
            return
        if status == "success":
            links[idx]["success"] += 1
        else:
            links[idx]["failed"] += 1
        self._save()

    def find_link_index(self, url: str | None) -> int | None:
        if not url:
            return None
        for i, link in enumerate(self.data["links"]):
            if link["url"] == url:
                return i
        return None

    def record_result_by_url(self, url: str | None, status: str, duration: float = 0, batch_id: float | None = None):
        idx = self.find_link_index(url)
        if idx is None:
            idx = self.data["active_index"]
        if idx >= len(self.data["links"]):
            return
        link = self.data["links"][idx]
        if status == "success":
            link["success"] += 1
            link["raw_total_time"] = link.get("raw_total_time", 0) + duration
            if batch_id is not None:
                bid = str(batch_id)
                link.setdefault("batches", {}).setdefault(bid, []).append(duration)
            # recompute total_time = sum of batch averages (real elapsed)
            bt = 0.0
            for durs in link.get("batches", {}).values():
                if durs:
                    bt += sum(durs) / len(durs)
            link["total_time"] = round(bt, 1)
            link["avg_time"] = round(link["raw_total_time"] / link["success"], 1)
        else:
            link["failed"] += 1
        self._save()

    def advance_if_needed(self) -> bool:
        links = self.data["links"]
        updated = False
        while self.data["active_index"] < len(links) and links[self.data["active_index"]]["success"] >= SUCCESS_LIMIT:
            links[self.data["active_index"]]["status"] = "done"
            self.data["active_index"] += 1
            updated = True
        if updated and self.data["active_index"] < len(links):
            links[self.data["active_index"]]["status"] = "active"
        self._save()
        return updated

    def add_links(self, urls: list[str]):
        for url in urls:
            url = url.strip()
            if url:
                self.data["links"].append({
                    "url": url,
                    "success": 0,
                    "failed": 0,
                    "total_time": 0,
                    "raw_total_time": 0,
                    "avg_time": 0,
                    "batches": {},
                    "status": "pending",
                })
        if self.data["links"] and self.data["active_index"] == 0:
            self.data["links"][0]["status"] = "active"
        self._save()

    def reset(self):
        for link in self.data["links"]:
            link["success"] = 0
            link["failed"] = 0
            link["total_time"] = 0
            link["raw_total_time"] = 0
            link["avg_time"] = 0
            link["batches"] = {}
        self._save()

    def is_exhausted(self) -> bool:
        return self.data["active_index"] >= len(self.data["links"])

    def advance_manual(self) -> bool:
        links = self.data["links"]
        idx = self.data["active_index"]
        if idx >= len(links):
            return False
        links[idx]["status"] = "done"
        if idx + 1 < len(links):
            links[idx + 1]["status"] = "active"
            self.data["active_index"] = idx + 1
            self._save()
            return True
        self._save()
        return False

    def get_last_line(self) -> int:
        return self.data.get("last_result_line", 0)

    def set_last_line(self, n: int):
        self.data["last_result_line"] = n
        self._save()

    def stats_string(self) -> str:
        links = self.data["links"]
        idx = self.data["active_index"]
        total = len(links)
        if total == 0:
            return "📦 Пул ссылок пуст"

        done_count = sum(1 for l in links if l["status"] == "done")
        active = links[idx] if 0 <= idx < len(links) else None
        pending_count = sum(1 for l in links if l["status"] == "pending")

        if active:
            ac = active["url"].split("/")[-1][:8]
            af = f" ❌{active['failed']}" if active["failed"] else ""
            summary = f"📦 {done_count}/{total} готово | ▶️ #{idx+1} {ac} {active['success']}/{SUCCESS_LIMIT}{af} | ⏳ {pending_count} ожидает"
        else:
            summary = f"📦 {done_count}/{total} готово"

        rows = [summary]
        row = []
        max_per_row = 3
        for i, link in enumerate(links):
            marker = "✅" if link["status"] == "done" else "▶️" if link["status"] == "active" else "⏳"
            code = link["url"].split("/")[-1][:8]
            s = link["success"]
            f_count = f"❌{link['failed']}" if link["failed"] else ""
            entry = f"#{i+1:<2} {code:<8} {s:>3}/{SUCCESS_LIMIT} {marker}"
            if f_count:
                entry += f" {f_count}"
            row.append(entry)
            if len(row) == max_per_row:
                rows.append("  " + " | ".join(row))
                row = []
        if row:
            rows.append("  " + " | ".join(row))

        return "\n".join(rows)
