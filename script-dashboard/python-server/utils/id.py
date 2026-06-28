"""ID generation and formatting utilities."""
import uuid
import re


def generate_id() -> str:
    return str(uuid.uuid4())


def strip_comments(script: str) -> str:
    if not script:
        return ""
    lines = script.split("\n")
    result = []
    in_block = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        if '"""' in line:
            in_block = not in_block
            continue
        if in_block:
            continue
        # Remove inline comments (but not inside strings - simple heuristic)
        if "#" in line:
            before = line.split("#")[0]
            if before.strip():
                result.append(before)
        else:
            result.append(line)
    return "\n".join(result)


def format_time_ago(ts: float) -> str:
    seconds = max(0, (__import__("time").time() * 1000 - ts) / 1000)
    if seconds < 10:
        return "just now"
    if seconds < 60:
        return "{}s ago".format(int(seconds))
    minutes = int(seconds / 60)
    if minutes < 60:
        return "{}m ago".format(minutes)
    hours = int(minutes / 60)
    if hours < 24:
        return "{}h ago".format(hours)
    days = int(hours / 24)
    return "{}d ago".format(days)
