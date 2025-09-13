import requests
import time
import csv
import re
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import random
import argparse


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
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
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
                    title = link.get("data-original-title", "").lower()

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

    def scrape_mods_streaming(self, start_id=1, end_id=10, filename="mod_data.csv"):
        """Stream scraping mod information, write while scraping"""
        # Initialize CSV file
        self.init_csv_file(filename)

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


def main(start_id=1, end_id=10, filename="mod_data.csv"):
    scraper = MCModScraper()

    print("Starting to scrape mcmod.cn data...")
    print(f"Target: Mod information for IDs {start_id}-{end_id}")
    print(f"Output file: {filename}")
    print("-" * 50)

    scraper.scrape_mods_streaming(start_id=start_id, end_id=end_id, filename=filename)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="MCMod.cn scraper - Extract mod information from mcmod.cn",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python mod_data_scraper.py                              # Use default values (1-10, mod_data.csv)
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
        default="mod_data.csv",
        help="Output CSV filename (default: mod_data.csv)",
    )

    args = parser.parse_args()

    # Validate arguments
    if args.start > args.end:
        print("Error: Start ID must be less than or equal to End ID")
        exit(1)

    if args.start < 1:
        print("Error: Start ID must be greater than 0")
        exit(1)

    main(start_id=args.start, end_id=args.end, filename=args.output)
