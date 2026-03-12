import re
import sys
from pathlib import Path
from datetime import datetime

sys.path.append(str(Path(__file__).resolve().parents[1]))

import requests
import pdfplumber

from item_template import create_empty_item
from api_client import BackendApiClient


class MoxiesCanadaScraper:
    def __init__(self):
        self.restaurant_id = "moxies_ca"
        self.restaurant_name = "Moxies (Canada)"
        self.source_url = "https://moxies.com/wp-content/uploads/restaurant-menus/459/nutritional-guide.pdf"
        self.pdf_url = self.source_url

    def download_pdf(self, url: str, save_path: Path):
        save_path.parent.mkdir(parents=True, exist_ok=True)

        response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=120)
        response.raise_for_status()

        save_path.write_bytes(response.content)
        return save_path

    def clean_cell(self, text):
        if text is None:
            return ""
        return " ".join(str(text).split()).strip()

    def pick_first_number(self, text: str):
        if not text:
            return None

        text = text.replace(",", "").strip()

        if "-" in text:
            text = text.split("-", 1)[0].strip()

        m = re.search(r"\d+(?:\.\d+)?", text)
        if not m:
            return None

        try:
            return float(m.group(0))
        except Exception:
            return None

    def looks_like_category_row(self, cells):
        if not cells:
            return False

        first = self.clean_cell(cells[0] if len(cells) > 0 else "")
        if not first:
            return False

        rest = [self.clean_cell(x) for x in cells[1:]]
        if any(x for x in rest):
            return False

        if any(ch.isdigit() for ch in first):
            return False

        if first.upper() != first:
            return False

        return True

    def looks_like_item_name(self, text: str):
        if not text:
            return False

        t = self.clean_cell(text)
        bad = [
            "SERVING",
            "CALORIES",
            "TOTAL FAT",
            "SATURATED",
            "TRANS FAT",
            "CHOLESTEROL",
            "SODIUM",
            "CARBOHYDRATES",
            "DIETARY FIBRE",
            "PROTEIN",
            "SUGAR",
            "Nutritional guide",
            "Page",
            "©",
        ]
        low = t.lower()
        for b in bad:
            if b.lower() in low:
                return False

        if len(t) < 3:
            return False

        return True

    def infer_portion(self, item_name: str):
        name = (item_name or "").lower()
        if "small" in name:
            return "small"
        if "regular" in name:
            return "regular"
        if "large" in name:
            return "large"
        if "double" in name:
            return "double"
        if "single" in name:
            return "single"
        return None

    def build_item(self, item_name: str, row: dict):
        item = create_empty_item()

        clean_name = item_name.replace("◊", "").strip()

        item["restaurant_id"] = self.restaurant_id
        item["restaurant_name"] = self.restaurant_name
        item["item_name"] = clean_name
        item["category"] = row.get("category")
        item["portion"] = self.infer_portion(clean_name)
        portion = (item["portion"] or "").strip()
        item["unique_key"] = f"{self.restaurant_id}|{item['item_name']}|{portion}".lower()
        item["price_cad"] = None
        item["source_url"] = self.pdf_url
        item["scraped_at"] = datetime.utcnow().isoformat()

        item["macros"]["calories"] = row["calories"]
        item["macros"]["protein_g"] = row["protein_g"]
        item["macros"]["carbs_g"] = row["carbs_g"]
        item["macros"]["fat_g"] = row["fat_g"]
        item["macros"]["sodium_mg"] = row["sodium_mg"]
        item["macros"]["sugar_g"] = row["sugar_g"]

        return item

    def safe_float(self, numbers, index):
        if index < 0 or index >= len(numbers):
            return None
        v = numbers[index]
        if v is None:
            return None
        try:
            return float(v)
        except Exception:
            return None

    def safe_int(self, numbers, index):
        if index < 0 or index >= len(numbers):
            return None
        v = numbers[index]
        if v is None:
            return None
        try:
            return int(float(v))
        except Exception:
            return None

    def parse_table_row(self, cells, current_category):
        if not cells or len(cells) < 10:
            return None

        first = self.clean_cell(cells[0])
        if not self.looks_like_item_name(first):
            return None

        joined = [self.clean_cell(x) for x in cells]

        numbers = []
        for x in joined[1:]:
            n = self.pick_first_number(x)
            if n is None:
                numbers.append(None)
            else:
                numbers.append(n)

        calories = self.safe_int(numbers, 1)
        if calories is None:
            return None

        row = {
            "category": current_category,
            "item_name": first,
            "calories": calories,
            "fat_g": self.safe_float(numbers, 2),
            "sodium_mg": self.safe_int(numbers, 5),
            "carbs_g": self.safe_float(numbers, 8),
            "sugar_g": self.safe_float(numbers, 9),
            "protein_g": self.safe_float(numbers, 10),
        }

        return row

    def extract_tables(self, pdf_path: Path):
        all_rows = []

        settings = {
            "vertical_strategy": "lines",
            "horizontal_strategy": "lines",
            "intersection_tolerance": 5,
            "snap_tolerance": 3,
            "join_tolerance": 3,
        }

        with pdfplumber.open(str(pdf_path)) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables(table_settings=settings) or []
                for table in tables:
                    for r in table:
                        all_rows.append(r)

        return all_rows

    def scrape(self):
        pdf_path = self.download_pdf(self.pdf_url, Path("data/moxies_ca_nutrition.pdf"))

        table_rows = self.extract_tables(pdf_path)

        results = []
        seen = set()
        current_category = None

        for cells in table_rows:
            if self.looks_like_category_row(cells):
                current_category = self.clean_cell(cells[0])
                continue

            parsed = self.parse_table_row(cells, current_category)
            if not parsed:
                continue

            portion = self.infer_portion(parsed["item_name"]) or ""
            key = f"{self.restaurant_id}|{parsed['item_name']}|{portion}".lower()
            if key in seen:
                continue

            seen.add(key)

            row = {
                "category": parsed.get("category"),
                "calories": parsed["calories"],
                "protein_g": parsed["protein_g"],
                "carbs_g": parsed["carbs_g"],
                "fat_g": parsed["fat_g"],
                "sodium_mg": parsed["sodium_mg"],
                "sugar_g": parsed["sugar_g"],
            }

            results.append(self.build_item(parsed["item_name"], row))

        return results


if __name__ == "__main__":
    scraper = MoxiesCanadaScraper()
    items = scraper.scrape()

    print("Items scraped:", len(items))

    api = BackendApiClient("http://127.0.0.1:5000")
    ok, fail = api.add_items(items)

    print("Sent to backend:", ok, "ok,", fail, "failed")