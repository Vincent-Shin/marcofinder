import re
import sys
from pathlib import Path
from datetime import datetime

sys.path.append(str(Path(__file__).resolve().parents[1]))

import requests
import pdfplumber

from item_template import create_empty_item
from api_client import BackendApiClient


class ChucksRoadhouseCanadaScraper:
    def __init__(self):
        self.restaurant_id = "chucks_roadhouse_ca"
        self.restaurant_name = "Chuck’s Roadhouse (Canada)"
        self.source_url = "https://chucksroadhouse.com/wp-content/uploads/2025/09/CRH_Nutritionals_SEPT25.pdf"
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
            "NUTRITION",
            "ALLERGEN",
            "CHART",
            "SERVING",
            "CALORIES",
            "FAT",
            "SODIUM",
            "CARB",
            "FIBRE",
            "SUGAR",
            "PROTEIN",
            "CHOLESTEROL",
            "VITAMIN",
            "CALCIUM",
            "IRON",
            "GLUTEN",
            "DAIRY",
            "EGG",
            "SOY",
            "FISH",
            "SHELLFISH",
            "PEANUT",
            "TREE NUT",
            "SESAME",
            "MUSTARD",
            "SULPHITES",
            "PAGE",
            "©",
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
        low = t.lower()

        bad = [
            "nutritional",
            "allergen",
            "serving",
            "calories",
            "total fat",
            "sodium",
            "carbohydrate",
            "sugar",
            "protein",
            "cholesterol",
            "vitamin",
            "calcium",
            "iron",
            "page",
            "©",
        ]

        for b in bad:
            if b in low:
                return False

        if len(t) < 3:
            return False

        return True

    def infer_portion(self, item_name: str):
        name = (item_name or "").lower()

        for w in ["large", "regular", "small", "double", "single"]:
            if re.search(rf"\b{w}\b", name):
                return w

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

        tokens = [t for t in self.clean_cell(line).split(" ") if t]
        if len(tokens) < 8:
            return None

        serving_i = None
        for i in range(len(tokens) - 1):
            a = tokens[i]
            b = tokens[i + 1]
            if re.fullmatch(r"\d+(?:\.\d+)?", a) and b.lower() in {"serv", "serv.", "serving", "oz", "fl", "fl.", "g"}:
                serving_i = i
                break
            if a.lower() in {"1serv", "1serv.", "1serving"}:
                serving_i = i
                break

        if serving_i is None:
            return None

        start_i = serving_i + 2
        if tokens[serving_i].lower() in {"1serv", "1serv.", "1serving"}:
            start_i = serving_i + 1

        nums = []
        for j in range(start_i, len(tokens)):
            t = tokens[j].replace(",", "")
            if re.fullmatch(r"\d+(?:\.\d+)?", t):
                nums.append(t)
                continue
            break

        if len(nums) < 10:
            return None

        name = " ".join(tokens[:serving_i]).strip()
        name = self.clean_cell(name)
        if not name or len(name) < 3:
            return None

        calories = self.pick_first_number(nums[0])
        fat_g = self.pick_first_number(nums[1])
        sodium_mg = self.pick_first_number(nums[5])
        carbs_g = self.pick_first_number(nums[6])
        sugar_g = self.pick_first_number(nums[8])
        protein_g = self.pick_first_number(nums[9])

        if calories is None:
            return None

        return {
            "item_name": name,
            "calories": self.safe_int(calories),
            "fat_g": self.safe_float(fat_g),
            "sodium_mg": self.safe_int(sodium_mg),
            "carbs_g": self.safe_float(carbs_g),
            "sugar_g": self.safe_float(sugar_g),
            "protein_g": self.safe_float(protein_g),
        }

    def scrape(self):
        pdf_path = self.download_pdf(self.pdf_url, Path("data/chucks_roadhouse_nutrition.pdf"))

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
                "category": current_category,
                "calories": parsed["calories"],
                "protein_g": parsed["protein_g"],
                "carbs_g": parsed["carbs_g"],
                "fat_g": parsed["fat_g"],
                "sodium_mg": parsed["sodium_mg"],
                "sugar_g": parsed["sugar_g"],
            }

            results.append(self.build_item(item_name, row))

        return results


if __name__ == "__main__":
    scraper = ChucksRoadhouseCanadaScraper()
    items = scraper.scrape()

    print("Items scraped:", len(items))

    api = BackendApiClient("http://127.0.0.1:5000")
    ok, fail = api.add_items(items)

    print("Sent to backend:", ok, "ok,", fail, "failed")