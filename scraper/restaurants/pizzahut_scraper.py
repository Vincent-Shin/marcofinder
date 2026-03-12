import re
import sys
from pathlib import Path
from datetime import datetime

sys.path.append(str(Path(__file__).resolve().parents[1]))

import requests
import pdfplumber

from item_template import create_empty_item
from api_client import BackendApiClient


class PizzaHutCanadaScraper:
    def __init__(self):
        self.restaurant_id = "pizza_hut_ca"
        self.restaurant_name = "Pizza Hut (Canada)"
        self.source_url = "https://assets.ctfassets.net/foi9ggpj1j8o/7rP6F2kWHOSs5DTlolMoeM/1473cdd8784a6ff7ae8eccf56fe52e04/nutritionals.14841ea6d15764c94dd896afffdb2452.pdf"
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

    def infer_portion(self, item_name: str):
        name = (item_name or "").lower()

        if " ppp " in f" {name} " or name.endswith(" ppp"):
            return "ppp"

        if " small " in f" {name} " or name.endswith(" small"):
            return "small"

        if " medium " in f" {name} " or name.endswith(" medium"):
            return "medium"

        if " large " in f" {name} " or name.endswith(" large"):
            return "large"

        return None

    def looks_like_item_name(self, text: str):
        if not text:
            return False

        t = self.clean_cell(text)
        low = t.lower()

        bad = [
            "pizza hut canada nutrition information",
            "serving size",
            "weight (g)",
            "calories",
            "total fat",
            "saturated fat",
            "trans fat",
            "cholesterol",
            "sodium",
            "carbohydrates",
            "dietary fiber",
            "sugars",
            "protein",
            "vitamin",
            "% daily value",
            "nutrition facts",
            "page",
            "©",
        ]

        for b in bad:
            if b in low:
                return False

        if len(t) < 3:
            return False

        if not re.search(r"\d", t):
            return False

        return True

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

    def normalize_name(self, name_part: str):
        t = self.clean_cell(name_part)

        t = re.sub(r"\bPer\s+1\s+Pizza\b", "", t, flags=re.IGNORECASE)
        t = re.sub(r"\b1\s+slice\s*=\s*[^ ]+\s*pizza\b", "", t, flags=re.IGNORECASE)
        t = re.sub(r"\bpizza\b", "", t, flags=re.IGNORECASE)

        t = self.clean_cell(t)
        return t

    def parse_item_line(self, line: str, current_category):
        if not self.looks_like_item_name(line):
            return None

        if not re.search(r"\b(ppp|small|medium|large)\b", line, flags=re.IGNORECASE):
            return None

        m = re.search(r"\d", line)
        if not m:
            return None

        name_part = self.normalize_name(line[: m.start()])
        if not name_part or len(name_part) < 3:
            return None

        nums = re.findall(r"\d+(?:\.\d+)?", line.replace(",", ""))
        if len(nums) < 11:
            return None

        weight_g = self.safe_float(nums[0])
        calories = self.safe_int(nums[1])
        fat_g = self.safe_float(nums[2])
        sodium_mg = self.safe_int(nums[6])
        carbs_g = self.safe_float(nums[7])
        sugar_g = self.safe_float(nums[9])
        protein_g = self.safe_float(nums[10])

        if calories is None:
            return None

        return {
            "category": current_category,
            "item_name": name_part,
            "calories": calories,
            "fat_g": fat_g,
            "sodium_mg": sodium_mg,
            "carbs_g": carbs_g,
            "sugar_g": sugar_g,
            "protein_g": protein_g,
        }

    def scrape(self):
        pdf_path = self.download_pdf(self.pdf_url, Path("data/pizza_hut_ca_nutrition.pdf"))

        lines = self.extract_lines(pdf_path)

        results = []
        seen = set()
        current_category = None

        for ln in lines:
            if ln and not re.search(r"\d", ln) and len(ln) >= 3:
                t = self.clean_cell(ln)
                if t.lower() not in {"nutrition facts % daily value"} and "pizza hut" not in t.lower():
                    current_category = t
                continue

            parsed = self.parse_item_line(ln, current_category)
            if not parsed:
                continue

            portion = self.infer_portion(parsed["item_name"]) or ""
            key = f"{self.restaurant_id}|{parsed['item_name']}|{portion}".lower()
            if key in seen:
                continue

            seen.add(key)

            row = {
                "category": parsed.get("category"),
                "calories": parsed.get("calories"),
                "protein_g": parsed.get("protein_g"),
                "carbs_g": parsed.get("carbs_g"),
                "fat_g": parsed.get("fat_g"),
                "sodium_mg": parsed.get("sodium_mg"),
                "sugar_g": parsed.get("sugar_g"),
            }

            results.append(self.build_item(parsed["item_name"], row))

        return results


if __name__ == "__main__":
    scraper = PizzaHutCanadaScraper()
    items = scraper.scrape()

    print("Items scraped:", len(items))

    api = BackendApiClient("http://127.0.0.1:5000")
    ok, fail = api.add_items(items)

    print("Sent to backend:", ok, "ok,", fail, "failed")