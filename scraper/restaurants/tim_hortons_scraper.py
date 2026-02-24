import re
import sys
from pathlib import Path
from datetime import datetime

sys.path.append(str(Path(__file__).resolve().parents[1]))

import requests
import pdfplumber

from item_template import create_empty_item
from api_client import BackendApiClient


class TimHortonsCanadaScraper:
    def __init__(self):
        self.restaurant_id = "tim_hortons_ca"
        self.restaurant_name = "Tim Hortons (Canada)"
        self.source_url = "https://www.timhortons.ca/nutrition-and-allergens"
        self.pdf_url = "https://cdn.sanity.io/files/czqk28jt/staging_th_ca/899cfff5cf0408bc5fbd08e959cfbcf6ac171c25.pdf"

    def download_pdf(self, url: str, save_path: Path):
        save_path.parent.mkdir(parents=True, exist_ok=True)

        response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=120)
        response.raise_for_status()

        save_path.write_bytes(response.content)
        return save_path

    def extract_lines(self, pdf_path: Path):
        lines = []

        with pdfplumber.open(str(pdf_path)) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                for raw in text.splitlines():
                    cleaned = " ".join(raw.split())
                    if cleaned:
                        lines.append(cleaned)

        return lines

    def infer_portion(self, item_name: str):
        name = item_name.lower()

        if "coffee" in name or "tea" in name or "latte" in name or "cappuccino" in name:
            return "1 drink"

        if "donut" in name or "muffin" in name or "cookie" in name or "croissant" in name:
            return "1 item"

        if "wrap" in name or "sandwich" in name or "bagel" in name:
            return "1 item"

        return None

    def parse_candidate_row(self, line: str):
        numbers = re.findall(r"\d+(?:\.\d+)?", line)
        if len(numbers) < 6:
            return None

        name_split = re.split(r"\s+\d", line, maxsplit=1)
        if not name_split:
            return None

        item_name = name_split[0].strip()
        if not item_name or len(item_name) < 3:
            return None

        calories = self.to_int(numbers[0])
        if calories is None:
            return None

        fat_g = self.to_float(numbers[3]) if len(numbers) > 3 else None
        sodium_mg = self.to_int(numbers[4]) if len(numbers) > 4 else None
        carbs_g = self.to_float(numbers[2]) if len(numbers) > 2 else None
        sugar_g = self.to_float(numbers[5]) if len(numbers) > 5 else None
        protein_g = self.to_float(numbers[1]) if len(numbers) > 1 else None

        return {
            "item_name": item_name,
            "calories": calories,
            "protein_g": protein_g,
            "carbs_g": carbs_g,
            "fat_g": fat_g,
            "sodium_mg": sodium_mg,
            "sugar_g": sugar_g
        }

    def build_item(self, row: dict):
        item = create_empty_item()

        item["restaurant_id"] = self.restaurant_id
        item["restaurant_name"] = self.restaurant_name
        item["item_name"] = row["item_name"].strip()
        item["category"] = None
        item["portion"] = self.infer_portion(row["item_name"])
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

    def scrape(self):
        pdf_path = self.download_pdf(self.pdf_url, Path("data/tim_hortons_nutrition.pdf"))
        lines = self.extract_lines(pdf_path)

        results = []
        seen = set()

        for line in lines:
            row = self.parse_candidate_row(line)
            if not row:
                continue

            key = row["item_name"].lower()
            if key in seen:
                continue

            seen.add(key)
            results.append(self.build_item(row))

        return results

    def to_int(self, value):
        try:
            return int(float(value))
        except Exception:
            return None

    def to_float(self, value):
        try:
            return float(value)
        except Exception:
            return None


if __name__ == "__main__":
    scraper = TimHortonsCanadaScraper()
    items = scraper.scrape()

    print("Items scraped:", len(items))

    api = BackendApiClient("http://127.0.0.1:5000")
    ok, fail = api.add_items(items)

    print("Sent to backend:", ok, "ok,", fail, "failed")