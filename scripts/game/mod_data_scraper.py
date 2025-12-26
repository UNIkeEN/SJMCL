import argparse
import csv
import os
import random
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

MAX_AUTO_RANGE_BATCH = (
    300  # Safety cap for "auto-range" scraping to keep CI jobs within time limits
)
DEFAULT_OUTPUT = str(
    Path(__file__).resolve().parents[2] / "src-tauri" / "assets" / "db" / "mod_data.csv"
)


class MCModScraper:
    def __init__(self):
        self.base_url = "https://www.mcmod.cn"
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
            }
        )

    def get_mod_info(self, mod_id):
        """Get detailed information for a single mod"""
        url = f"{self.base_url}/class/{mod_id}.html"

        try:
            print(f"Scraping mod ID: {mod_id}")
            response = self._get_with_retries(url, context=f"mod {mod_id}")
            if not response:
                print(f"Failed to request mod {mod_id} after retries")
                return None

            response.encoding = "utf-8"

            soup = BeautifulSoup(response.text, "html.parser")

            # Initialize return data
            mod_data = {
                "mcmod_id": mod_id,
                "curseforge_slug": "",
                "modrinth_slug": "",
                "name": "",
                "subname": "",
                "abbr": "",
            }

            # Get mod title information
            title_element = soup.find("div", class_="class-title")
            if title_element:
                # Get abbreviation (short name)
                short_name_elem = title_element.find("span", class_="short-name")
                if short_name_elem:
                    abbr_text = short_name_elem.get_text(strip=True)
                    # Remove brackets
                    mod_data["abbr"] = re.sub(r"[\[\]]", "", abbr_text)

                # Get Chinese name
                h3_elem = title_element.find("h3")
                if h3_elem:
                    cn_name = h3_elem.get_text(strip=True)
                    mod_data["name"] = cn_name

                # Get English name
                h4_elem = title_element.find("h4")
                if h4_elem:
                    en_name = h4_elem.get_text(strip=True)
                    # If there's a Chinese name, use English name as subname
                    if mod_data["name"]:
                        mod_data["subname"] = en_name
                    else:
                        # If no Chinese name, use English name as main name
                        mod_data["name"] = en_name

            # Get related link information
            link_frame = soup.find("div", class_="common-link-frame")
            if link_frame:
                links = link_frame.find_all("a", href=True)
                for link in links:
                    href = link.get("href", "")

                    # Decode link
                    if "/target/" in href:
                        try:
                            import base64

                            encoded_part = href.split("/target/")[-1]
                            decoded_url = base64.b64decode(encoded_part).decode("utf-8")

                            # Check if it's a CurseForge link
                            if (
                                "curseforge.com" in decoded_url
                                and not mod_data["curseforge_slug"]
                            ):
                                # Extract slug
                                match = re.search(
                                    r"/minecraft/mc-mods/([^/?]+)", decoded_url
                                )
                                if match:
                                    mod_data["curseforge_slug"] = match.group(1)

                            # Check if it's a Modrinth link
                            elif (
                                "modrinth.com" in decoded_url
                                and not mod_data["modrinth_slug"]
                            ):
                                # Extract slug
                                match = re.search(r"/mod/([^/?]+)", decoded_url)
                                if match:
                                    mod_data["modrinth_slug"] = match.group(1)

                        except Exception as e:
                            print(f"Failed to decode link: {e}")
                            continue

            print(f"Successfully retrieved mod {mod_id} info: {mod_data['name']}")
            return mod_data

        except requests.exceptions.RequestException as e:
            print(f"Failed to request mod {mod_id}: {e}")
            return None
        except Exception as e:
            print(f"Failed to parse mod {mod_id} data: {e}")
            return None

    def scrape_mods_streaming(
        self, start_id=1, end_id=10, filename="mod_data.csv", append=False
    ):
        """Stream scraping mod information, write while scraping"""
        self.prepare_csv(filename, append)

        success_count = 0
        fail_count = 0

        for mod_id in range(start_id, end_id + 1):
            print(f"\nProgress: {mod_id - start_id + 1}/{end_id - start_id + 1}")

            mod_data = self.get_mod_info(mod_id)

            if mod_data:
                success_count += 1
            else:
                fail_count += 1
                # Add empty record even if failed, to maintain ID continuity
                mod_data = {
                    "mcmod_id": mod_id,
                    "curseforge_slug": "",
                    "modrinth_slug": "",
                    "name": f"Mod{mod_id}(failed)",
                    "subname": "",
                    "abbr": "",
                }

            # Write to CSV file immediately
            self.append_to_csv(mod_data, filename)
            print(f"Written to file: {mod_data['name']}")

            # Random delay 1-3 seconds
            delay = random.uniform(1, 3)
            print(f"Waiting {delay:.2f} seconds...")
            time.sleep(delay)

        print(
            f"\nScraping completed! Processed {end_id - start_id + 1} items, {success_count} successful, {fail_count} failed"
        )
        return success_count, fail_count

    def get_latest_mod_id_online(self):
        """Fetch the newest mod id from mcmod list page"""
        url = f"{self.base_url}/modlist.html?sort=createtime"
        response = self._get_with_retries(url, context="latest mod id")
        if not response:
            print("Failed to fetch latest mod id after multiple attempts")
            return None

        response.encoding = "utf-8"
        soup = BeautifulSoup(response.text, "html.parser")
        modlist_block = soup.find("div", class_="modlist-block")
        if not modlist_block:
            print("Failed to locate .modlist-block on page")
            return None
        anchor = modlist_block.find("a", href=re.compile(r"/class/\d+\.html"))
        if not anchor:
            print("Failed to locate mod anchor inside .modlist-block")
            return None
        match = re.search(r"/class/(\d+)\.html", anchor["href"])
        if not match:
            print("Failed to parse mod id from anchor href")
            return None
        latest_id = int(match.group(1))
        print(f"Latest mod id online: {latest_id}")
        return latest_id

    def _get_with_retries(
        self,
        url,
        *,
        context,
        timeout=10,
        max_retries=3,
        backoff_base=1.0,
        jitter=0.5,
    ):
        """Shared GET with exponential backoff to keep retry behavior consistent."""
        for attempt in range(max_retries):
            try:
                response = self.session.get(url, timeout=timeout)
                response.raise_for_status()
                return response
            except requests.RequestException as exc:
                attempt_number = attempt + 1
                print(
                    f"Request for {context} failed (attempt {attempt_number}/{max_retries}): {exc}"
                )
                if attempt_number < max_retries:
                    sleep_time = backoff_base * (2**attempt) + random.uniform(0, jitter)
                    time.sleep(sleep_time)
        return None

    def get_last_recorded_id(self, filename):
        """Read last recorded mcmod id from existing CSV"""
        if not os.path.exists(filename):
            return 0

        def _iter_lines_reverse(path, chunk_size=4096):
            """Yield non-empty lines from end to start (binary-safe)."""
            with open(path, "rb") as f:
                f.seek(0, os.SEEK_END)
                position = f.tell()
                if position == 0:
                    return

                buffer = b""
                while position > 0:
                    read_size = min(chunk_size, position)
                    position -= read_size
                    f.seek(position)
                    chunk = f.read(read_size)
                    buffer = chunk + buffer
                    lines = buffer.split(b"\n")
                    buffer = lines[0]
                    for line in reversed(lines[1:]):
                        stripped = line.strip()
                        if stripped:
                            yield stripped

                # Remaining buffer (first line)
                if buffer.strip():
                    yield buffer.strip()

        try:
            for raw_line in _iter_lines_reverse(filename):
                try:
                    line = raw_line.decode("utf-8-sig")
                except UnicodeDecodeError:
                    continue

                if line.lower().startswith("mcmod_id"):
                    continue  # skip header

                parts = line.split(",")
                if not parts:
                    continue

                try:
                    row_iter = csv.reader([line])
                    row = next(row_iter, None)
                except csv.Error:
                    continue
                if not row:
                    continue
                try:
                    last_id = int(row[0])
                    print(f"Last recorded mod id in CSV: {last_id}")
                    return last_id
                except (TypeError, ValueError, IndexError):
                    continue

        except Exception as exc:  # pragma: no cover - defensive
            print(f"Failed to read existing CSV {filename}: {exc}")
            return 0

        print("No valid id found in CSV, defaulting to 0")
        return 0

    def init_csv_file(self, filename="mcmod_data.csv"):
        """Initialize CSV file and write header"""
        fieldnames = [
            "mcmod_id",
            "curseforge_slug",
            "modrinth_slug",
            "name",
            "subname",
            "abbr",
        ]

        with open(filename, "w", newline="", encoding="utf-8-sig") as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()

        print(f"CSV file initialized: {filename}")

    def prepare_csv(self, filename, append=False):
        """Create CSV if missing or truncation requested"""
        directory = os.path.dirname(filename)
        if directory:
            os.makedirs(directory, exist_ok=True)

        if append and os.path.exists(filename):
            return
        self.init_csv_file(filename)

    def append_to_csv(self, mod_data, filename="mcmod_data.csv"):
        """Append single data record to CSV file"""
        fieldnames = [
            "mcmod_id",
            "curseforge_slug",
            "modrinth_slug",
            "name",
            "subname",
            "abbr",
        ]

        with open(filename, "a", newline="", encoding="utf-8-sig") as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writerow(mod_data)


def main(
    start_id=1,
    end_id=10,
    filename=DEFAULT_OUTPUT,
    append=False,
):
    scraper = MCModScraper()

    print("Starting to scrape mcmod.cn data...")
    print(f"Target: Mod information for IDs {start_id}-{end_id}")
    print(f"Output file: {filename}")
    print("-" * 50)

    scraper.scrape_mods_streaming(
        start_id=start_id, end_id=end_id, filename=filename, append=append
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="MCMod.cn scraper - Extract mod information from mcmod.cn",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python mod_data_scraper.py --auto-range                # Append new mods to default CSV
    python mod_data_scraper.py                              # Use default values (1-10, default CSV)
    python mod_data_scraper.py --start 1 --end 100         # Scrape IDs 1-100
    python mod_data_scraper.py --start 1000 --end 2000 --output mods.csv  # Custom range and file
    python mod_data_scraper.py -s 1 -e 50 -o test.csv      # Using short options
        """,
    )

    parser.add_argument(
        "--start", "-s", type=int, default=1, help="Starting mod ID (default: 1)"
    )

    parser.add_argument(
        "--end", "-e", type=int, default=10, help="Ending mod ID (default: 10)"
    )

    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default=DEFAULT_OUTPUT,
        help=f"Output CSV filename (default: {DEFAULT_OUTPUT})",
    )

    parser.add_argument(
        "--auto-range",
        action="store_true",
        help=(
            "Automatically continue from last id in output file to latest id online. "
            "Ignores --start/--end."
        ),
    )

    args = parser.parse_args()

    scraper = MCModScraper()

    if args.auto_range:
        last_id = scraper.get_last_recorded_id(args.output)
        latest_id = scraper.get_latest_mod_id_online()
        if latest_id is None:
            exit(1)

        start = last_id + 1
        end = latest_id

        if start > end:
            print(
                f"No new mods to fetch. Local last id {last_id}, latest online {latest_id}."
            )
            exit(0)

        # Limit batch size for CI safety
        if end - start + 1 > MAX_AUTO_RANGE_BATCH:
            original_end = end
            end = start + MAX_AUTO_RANGE_BATCH - 1
            print(f"Auto-range limited: {start}-{original_end} -> {start}-{end}")
    else:
        # Validate arguments
        if args.start > args.end:
            print("Error: Start ID must be less than or equal to End ID")
            exit(1)

        if args.start < 1:
            print("Error: Start ID must be greater than 0")
            exit(1)

        start = args.start
        end = args.end

    append_mode = args.auto_range or start > 1

    main(start_id=start, end_id=end, filename=args.output, append=append_mode)
