import subprocess
from pathlib import Path
import time
import sys

base_folder = Path(__file__).resolve().parent
scrapers_folder = base_folder / "restaurants"

files = sorted(scrapers_folder.glob("*_scraper.py"))

total = len(files)
success = 0
fail = 0

print("\nFound", total, "scrapers\n")
print("Using Python:", sys.executable)

for file in files:
    print("\n==============================")
    print("Running:", file.name)
    print("==============================")

    start = time.time()

    result = subprocess.run([sys.executable, str(file)], cwd=base_folder)

    end = time.time()

    if result.returncode == 0:
        print("Finished:", file.name)
        success += 1
    else:
        print("Failed:", file.name)
        fail += 1

    print("Time:", round(end - start, 2), "seconds")

print("\n==============================")
print("Scrapers complete")
print("==============================")
print("Total:", total)
print("Success:", success)
print("Failed:", fail)