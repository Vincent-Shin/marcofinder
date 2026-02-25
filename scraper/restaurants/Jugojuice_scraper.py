import re
import sys
from pathlib import Path
from datetime import datetime

sys.path.append(str(Path(__file__).resolve().parents[1]))

import requests
import pdfplumber

from item_template import create_empty_item
from api_client import BackendApiClient


class JugoJuiceCanadaScraper:
    def __init__(self):
        self.restaurant_id = "jugo_juice_ca"
        self.restaurant_name = "Jugo Juice (Canada)"
        self.source_url = "https://jugojuice.com/wp-content/uploads/2023/06/jj22_nat_003_nutrition-guide_en_apr21-v4.pdf"
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
            "NUTRITION GUIDE",
            "SIZE",
            "CALORIES",
            "PROTEIN",
            "FAT",
            "CARBS",
            "FIBRE",
            "VIT",
            "XTRA",
            "BENEFITS",
            "INGREDIENTS",
            "ALLERGEN",
            "PAGE",
            "©",
        ]

        up = t.upper()
        for b in bad:
            if b in up:
                return False

        return True

    def infer_portion(self, item_name: str):
        name = (item_name or "").lower()

        m = re.search(r"\b(\d+)\s*oz\b", name)
        if m:
            return f"{m.group(1)} oz"

        for w in ["large", "regular", "small", "double", "single"]:
            if re.search(rf"\b{w}\b", name):
                return w

        return None

    def build_item(self, item_name: str, row: dict, portion: str = None):
        item = create_empty_item()

        clean_name = item_name.replace("◊", "").strip()

        item["restaurant_id"] = self.restaurant_id
        item["restaurant_name"] = self.restaurant_name
        item["item_name"] = clean_name
        item["category"] = row.get("category")
        item["portion"] = portion
        portion_clean = (portion or "").strip()
        item["unique_key"] = f"{self.restaurant_id}|{item['item_name']}|{portion_clean}".lower()
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

    def looks_like_item_title(self, text: str):
        if not text:
            return False

        t = self.clean_cell(text)
        low = t.lower()

        bad = [
            "nutrition guide",
            "size calories",
            "calories protein",
            "protein fat carbs",
            "xtra benefits",
            "ingredients",
            "fresh pressed",
            "shots",
            "wraps",
            "snacks",
            "page",
            "©",
        ]

        for b in bad:
            if b in low:
                return False

        if re.search(r"\d", t):
            return False

        if len(t) < 3:
            return False

        return True

    def is_size_header(self, text: str):
        t = self.clean_cell(text).upper()
        return t.startswith("SIZE ") or t == "SIZE CALORIES PROTEIN FAT CARBS FIBRE" or "SIZE" in t and "CALORIES" in t and "PROTEIN" in t

    def parse_size_row(self, text: str):
        t = self.clean_cell(text)
        m = re.match(
            r"^(?P<size>\d+\s*oz\.?)\s+(?P<cal>\d+(?:,\d+)*)\s+(?P<prot>\d+(?:\.\d+)?)\s*g\s+(?P<fat>\d+(?:\.\d+)?)\s*g\s+(?P<carb>\d+(?:\.\d+)?)\s*g",
            t,
            flags=re.IGNORECASE,
        )
        if not m:
            return None

        portion = self.clean_cell(m.group("size")).lower().replace(".", "")
        portion = self.clean_cell(portion)

        calories = self.pick_first_number(m.group("cal"))
        protein_g = self.pick_first_number(m.group("prot"))
        fat_g = self.pick_first_number(m.group("fat"))
        carbs_g = self.pick_first_number(m.group("carb"))

        if calories is None:
            return None

        return {
            "portion": portion,
            "calories": self.safe_int(calories),
            "protein_g": self.safe_float(protein_g),
            "fat_g": self.safe_float(fat_g),
            "carbs_g": self.safe_float(carbs_g),
        }

    def scrape(self):
        pdf_path = self.download_pdf(self.pdf_url, Path("data/jugo_juice_nutrition.pdf"))

        lines = self.extract_lines(pdf_path)

        results = []
        seen = set()

        current_category = None
        pending_item = None
        waiting_for_sizes = False

        for ln in lines:
            if self.looks_like_category(ln):
                current_category = self.clean_cell(ln)
                pending_item = None
                waiting_for_sizes = False
                continue

            if self.is_size_header(ln):
                waiting_for_sizes = True
                continue

            if waiting_for_sizes and pending_item:
                parsed = self.parse_size_row(ln)
                if parsed:
                    portion = parsed["portion"]
                    key = f"{self.restaurant_id}|{pending_item}|{portion}".lower()
                    if key in seen:
                        continue
                    seen.add(key)

                    row = {
                        "category": current_category,
                        "calories": parsed["calories"],
                        "protein_g": parsed["protein_g"],
                        "carbs_g": parsed["carbs_g"],
                        "fat_g": parsed["fat_g"],
                        "sodium_mg": None,
                        "sugar_g": None,
                    }

                    results.append(self.build_item(pending_item, row, portion=portion))
                    continue

                if self.looks_like_item_title(ln) or self.looks_like_category(ln):
                    waiting_for_sizes = False
                    pending_item = None

            if self.looks_like_item_title(ln):
                pending_item = self.clean_cell(ln)
                continue

        return results


if __name__ == "__main__":
    scraper = JugoJuiceCanadaScraper()
    items = scraper.scrape()

    print("Items scraped:", len(items))

    api = BackendApiClient("http://127.0.0.1:5000")
    ok, fail = api.add_items(items)

    print("Sent to backend:", ok, "ok,", fail, "failed")