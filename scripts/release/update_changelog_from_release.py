import argparse
import re
from pathlib import Path


DEFAULT_EN_CHANGELOG = "CHANGELOG.md"
DEFAULT_ZH_CHANGELOG = "docs/CHANGELOG.zh-Hans.md"
HORIZONTAL_RULE_PATTERN = re.compile(r"(?m)^\s*-{3,}\s*$")
SECTION_HEADING_PATTERN = re.compile(r"(?m)^##\s+")
CHANGELOG_START_PATTERN = re.compile(r"^\s*(?:[-*+]\s+|\d+\.\s+|\|)")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Update changelog files from a published GitHub release body."
    )
    parser.add_argument("--release-tag", required=True)
    parser.add_argument("--published-date", required=True)
    parser.add_argument("--body-file", required=True, type=Path)
    parser.add_argument("--english-changelog", default=DEFAULT_EN_CHANGELOG, type=Path)
    parser.add_argument("--chinese-changelog", default=DEFAULT_ZH_CHANGELOG, type=Path)
    return parser.parse_args()


def normalize_newlines(text):
    return text.replace("\r\n", "\n").replace("\r", "\n")


def split_release_body(body):
    parts = [part.strip("\n") for part in HORIZONTAL_RULE_PATTERN.split(body)]
    parts = [part for part in parts if part.strip()]
    if len(parts) < 2:
        raise ValueError("Release body must contain English and Chinese sections split by ---")
    return parts[0], parts[1]


def trim_to_changelog_content(section):
    lines = [line.rstrip() for line in normalize_newlines(section).split("\n")]

    first_content_index = None
    for index, line in enumerate(lines):
        if CHANGELOG_START_PATTERN.match(line):
            first_content_index = index
            break

    if first_content_index is not None:
        lines = lines[first_content_index:]

    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()

    content = "\n".join(lines)
    if not content:
        raise ValueError("Release section does not contain changelog content")
    return content


def build_section(version, published_date, body):
    return f"## {version}\n\n`{published_date}`\n\n{body}\n"


def upsert_changelog_section(changelog_text, version, section):
    heading_pattern = re.compile(rf"(?m)^##\s+{re.escape(version)}\s*$")
    existing_heading = heading_pattern.search(changelog_text)

    if existing_heading:
        next_heading = SECTION_HEADING_PATTERN.search(changelog_text, existing_heading.end())
        end = next_heading.start() if next_heading else len(changelog_text)
        before = changelog_text[: existing_heading.start()].rstrip()
        after = changelog_text[end:].lstrip("\n")
        if after:
            return f"{before}\n\n{section.rstrip()}\n\n{after}"
        return f"{before}\n\n{section.rstrip()}\n"

    first_heading = SECTION_HEADING_PATTERN.search(changelog_text)
    if not first_heading:
        raise ValueError("Could not find the first changelog version heading")

    before = changelog_text[: first_heading.start()].rstrip()
    after = changelog_text[first_heading.start() :].lstrip("\n")
    return f"{before}\n\n{section.rstrip()}\n\n{after}"


def update_changelog(path, version, published_date, body):
    changelog_text = normalize_newlines(path.read_text(encoding="utf-8"))
    section = build_section(version, published_date, body)
    updated = upsert_changelog_section(changelog_text, version, section)
    if updated != changelog_text:
        path.write_text(updated, encoding="utf-8", newline="\n")
        print(f"Updated {path}")
    else:
        print(f"{path} is already up to date")


def main():
    args = parse_args()
    version = args.release_tag[1:] if args.release_tag.startswith("v") else args.release_tag
    body = normalize_newlines(args.body_file.read_text(encoding="utf-8"))
    english_body, chinese_body = split_release_body(body)

    english_content = trim_to_changelog_content(english_body)
    chinese_content = trim_to_changelog_content(chinese_body)

    update_changelog(args.english_changelog, version, args.published_date, english_content)
    update_changelog(args.chinese_changelog, version, args.published_date, chinese_content)


if __name__ == "__main__":
    main()
