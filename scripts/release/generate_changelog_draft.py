import requests
import re
import os
from packaging.version import Version

OWNER = "UNIkeEN"
REPO = "SJMCL"
TAG_PATTERN = re.compile(r"^v(.+)$")  # 版本号以v开始

def get_emoji(msg):
    msg_lower = msg.lower()
    if 'breaking' in msg_lower:
        return "🚨"
    if 'major' in msg_lower or 'minor' in msg_lower:
        return "🔥"
    if re.match(r'^(feat|feature)(\(|:)', msg_lower):
        return "🌟"
    if re.match(r'^fix(\(|:)', msg_lower):
        return "🐛"
    if re.match(r'^security(\(|:)', msg_lower):
        return "🔒"
    if re.match(r'^refactor(\(|:)', msg_lower):
        return "🛠"
    if re.match(r'^perf(\(|:)', msg_lower):
        return "⚡️"
    if re.match(r'^docs(\(|:)', msg_lower):
        return "📚"
    if re.match(r'^style(\(|:)', msg_lower):
        return "💄"
    if re.match(r'^(chore|deps)(\(|:)', msg_lower):
        return "📦"
    return ""

def get_headers():
    token = os.getenv("GITHUB_TOKEN")
    if token:
        return {"Authorization": f"token {token}"}
    return {}

def get_tags(owner, repo):
    url = f"https://api.github.com/repos/{owner}/{repo}/tags"
    resp = requests.get(url, headers=get_headers(), params={"per_page": 100, "page": 1})
    resp.raise_for_status()
    data = resp.json()
    tags = [tag['name'] for tag in data]
    return tags

def filter_and_sort_tags(tags):
    valid_tags = []
    for tag in tags:
        m = TAG_PATTERN.match(tag)
        if m:
            try:
                valid_tags.append((tag, Version(m.group(1))))
            except Exception:
                continue
    valid_tags.sort(key=lambda x: x[1], reverse=True)
    return [t[0] for t in valid_tags]

def compare_tags(owner, repo, base, head):
    url = f"https://api.github.com/repos/{owner}/{repo}/compare/{base}...{head}"
    resp = requests.get(url, headers=get_headers())
    resp.raise_for_status()
    return resp.json()

def main():
    tags = get_tags(OWNER, REPO)
    valid_tags = filter_and_sort_tags(tags)
    if len(valid_tags) < 2:
        print("# Changelog\n\nNot enough valid tags.\n")
        return
    latest, previous = valid_tags[0], valid_tags[1]
    print(f"# {latest}\n")
    diff = compare_tags(OWNER, REPO, previous, latest)
    for commit in diff['commits']:
        msg = commit['commit']['message'].splitlines()[0]
        sha = commit['sha'][:7]
        author = commit['author']['login'] if commit['author'] else 'unknown'
        emoji = get_emoji(msg)
        if emoji:
            print(f"- {emoji} {msg} @{author}")
        else:
            print(f"- {msg} @{author}")

if __name__ == "__main__":
    main()