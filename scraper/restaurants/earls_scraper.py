import re
import sys
from pathlib import Path
from datetime import datetime

sys.path.append(str(Path(__file__).resolve().parents[1]))

import requests
import pdfplumber

from item_template import create_empty_item
from api_client import BackendApiClient


class EarlsCanadaScraper:
    def __init__(self):
        self.restaurant_id = "earls_ca"
        self.restaurant_name = "Earls (Canada)"
        self.source_url = "https://earls.ca/wp-content/uploads/2025/03/EARLS-CANADA-NUTRITION-GUIDE-APRIL-2025-2.pdf"
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

    def looks_like_category(self, text: str):
        if not text:
            return False

        t = self.clean_cell(text)
        if len(t) < 3:
            return False

        if any(ch.isdigit() for ch in t):
            return False

        if t.upper() != t:
            return False

        bad = [
            "CANADA",
            "SERVING",
            "CALORIES",
            "TOTAL FAT",
            "SATURATED",
            "TRANS",
            "CHOLESTEROL",
            "SODIUM",
            "CARBOHYDRATES",
            "DIETARY",
            "SUGAR",
            "PROTEIN",
            "SOURCE",
            "HEALTH",
            "REQUIREMENTS",
            "LIMITS",
        ]

        up = t.upper()
        for b in bad:
            if b in up:
                return False

        return True

    def looks_like_item_name(self, text: str):
        if not text:
            return False

        t = self.clean_cell(text)

        bad = [
            "Daily Calorie and Sodium Requirements",
            "Healthy adults should aim",
            "Individual needs vary",
            "recommended limits",
            "Menu item may not be available",
            "Serving Size",
            "Calories",
            "Total Fat",
            "Saturated Fat",
            "Trans Fat",
            "Cholesterol",
            "Sodium",
            "Carbohydrates",
            "Dietary Fibre",
            "Sugar",
            "Protein",
            "Page",
            "©",
        ]

        low = t.lower()
        for b in bad:
            if b.lower() in low:
                return False

        if len(t) < 3:
            return False

        if not re.search(r"\d", t):
            return False

        return True

    def infer_portion(self, item_name: str):
        name = (item_name or "").lower()

        for w in ["large", "regular", "small", "double", "single"]:
            if re.search(rf"\b{w}\b", name):
                return w

        return None

    def build_item(self, item_name: str, row: dict, category: str = None):
        item = create_empty_item()

        clean_name = item_name.replace("◊", "").strip()

        item["restaurant_id"] = self.restaurant_id
        item["restaurant_name"] = self.restaurant_name
        item["item_name"] = clean_name
        item["category"] = category
        item["portion"] = self.infer_portion(clean_name)
        portion = (item["portion"] or "").strip()
        item["unique_key"] = f"{self.restaurant_id}|{item['item_name']}|{portion}".lower()
        item["price_cad"] = None
        item["source_url"] = self.pdf_url
        item["scraped_at"] = datetime.utcnow().isoformat()

        item["macros"]["calories"] = row.get("calories")
        item["macros"]["protein_g"] = row.get("protein_g")
        item["macros"]["carbs_g"] = row.get("carbs_g")
        item["macros"]["fat_g"] = row.get("fat_g")
        item["macros"]["sodium_mg"] = row.get("sodium_mg")
        item["macros"]["sugar_g"] = row.get("sugar_g")

        return item

    def safe_float(self, v):
        if v is None:
            return None
        try:
            return float(v)
        except Exception:
            return None

    def safe_int(self, v):
        if v is None:
            return None
        try:
            return int(float(v))
        except Exception:
            return None

    def extract_lines(self, pdf_path: Path):
        lines = []

        with pdfplumber.open(str(pdf_path)) as pdf:
            for page in pdf.pages:
                txt = page.extract_text() or ""
                for raw in txt.split("\n"):
                    c = self.clean_cell(raw)
                    if c:
                        lines.append(c)

        return lines

    def parse_item_line(self, line: str):
        if not self.looks_like_item_name(line):
            return None

        pat = re.compile(
            r"""^(?P<name>.+?)\s+
                (?P<serving>\d+(?:\.\d+)?)\s+
                \((?P<cal>\d+(?:,\d+)*)\)\s+
                (?P<fat>\d+(?:\.\d+)?)\s+
                (?P<sat>\d+(?:\.\d+)?)\s+
                (?P<trans>\d+(?:\.\d+)?)\s+
                (?P<chol>\d+(?:,\d+)*)\s+
                \((?P<sodium>\d+(?:,\d+)*)\)\s+
                (?P<carbs>\d+(?:\.\d+)?)\s+
                (?P<fibre>\d+(?:\.\d+)?)\s+
                (?P<sugar>\d+(?:\.\d+)?)\s+
                (?P<protein>\d+(?:\.\d+)?)
                $""",
            re.VERBOSE,
        )

        m = pat.match(line)
        if not m:
            return None

        item_name = self.clean_cell(m.group("name"))

        calories = self.pick_first_number(m.group("cal"))
        fat_g = self.pick_first_number(m.group("fat"))
        sodium_mg = self.pick_first_number(m.group("sodium"))
        carbs_g = self.pick_first_number(m.group("carbs"))
        sugar_g = self.pick_first_number(m.group("sugar"))
        protein_g = self.pick_first_number(m.group("protein"))

        if calories is None:
            return None

        return {
            "item_name": item_name,
            "calories": self.safe_int(calories),
            "fat_g": self.safe_float(fat_g),
            "sodium_mg": self.safe_int(sodium_mg),
            "carbs_g": self.safe_float(carbs_g),
            "sugar_g": self.safe_float(sugar_g),
            "protein_g": self.safe_float(protein_g),
        }

    def scrape(self):
        pdf_path = self.download_pdf(self.pdf_url, Path("data/earls_ca_nutrition.pdf"))

        lines = self.extract_lines(pdf_path)

        results = []
        seen = set()
        current_category = None

        for ln in lines:
            if self.looks_like_category(ln):
                current_category = self.clean_cell(ln)
                continue

            parsed = self.parse_item_line(ln)
            if not parsed:
                continue

            item_name = parsed["item_name"]
            portion = self.infer_portion(item_name) or ""
            unique_key = f"{self.restaurant_id}|{item_name}|{portion}".lower()

            if unique_key in seen:
                continue

            seen.add(unique_key)

            row = {
                "calories": parsed["calories"],
                "protein_g": parsed["protein_g"],
                "carbs_g": parsed["carbs_g"],
                "fat_g": parsed["fat_g"],
                "sodium_mg": parsed["sodium_mg"],
                "sugar_g": parsed["sugar_g"],
            }

            results.append(self.build_item(item_name, row, category=current_category))

        return results


if __name__ == "__main__":
    scraper = EarlsCanadaScraper()
    items = scraper.scrape()

    print("Items scraped:", len(items))

    api = BackendApiClient("http://127.0.0.1:5000")
    ok, fail = api.add_items(items)

    print("Sent to backend:", ok, "ok,", fail, "failed")