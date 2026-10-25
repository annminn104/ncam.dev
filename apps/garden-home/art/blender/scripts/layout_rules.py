"""Layout export rules that need no bpy (spec §7 camera stops, §8.2 sky), so system Python can test them.

Both functions raise LayoutError with a message fit to print as-is; export_layout.py turns it into sys.exit.
"""
import re

STOP_PREFIX = "CAM_stop_"
DEFAULT_SKY = {"sunrise": "06:00", "sunset": "18:00"}
# Mirrors the runtime schema (src/scene/schema.ts); [0-9] and fullmatch keep unicode digits and "\n" out.
HHMM_RE = re.compile(r"([01][0-9]|2[0-3]):[0-5][0-9]")
INDEX_RE = re.compile(r"[0-9]+")


class LayoutError(ValueError):
    pass


def stop_order(names):
    """CAM_stop_* names in numeric order of their suffix (CAM_stop_2 before CAM_stop_10)."""
    by_index = {}
    for name in names:
        suffix = name[len(STOP_PREFIX):]
        if not INDEX_RE.fullmatch(suffix):
            raise LayoutError(f"camera '{name}': the part after '{STOP_PREFIX}' must be a whole number (e.g. {STOP_PREFIX}01)")
        index = int(suffix)
        if index in by_index:
            raise LayoutError(f"cameras '{by_index[index]}' and '{name}' have the same stop number {index}")
        by_index[index] = name
    return [by_index[index] for index in sorted(by_index)]


def _minutes(hhmm):
    return int(hhmm[:2]) * 60 + int(hhmm[3:])


def sky_config(props, defaults=DEFAULT_SKY):
    """{'sunrise': 'HH:MM', 'sunset': 'HH:MM'} from scene custom properties; strict, because the
    runtime silently falls back to the poster when scene.json fails validation."""
    sky = {}
    for key, default in defaults.items():
        value = props.get(key, default)
        if not (isinstance(value, str) and HHMM_RE.fullmatch(value)):
            raise LayoutError(f"sky {key} must be HH:MM (two digits, 00:00-23:59), got {value!r}")
        sky[key] = value
    if _minutes(sky["sunrise"]) >= _minutes(sky["sunset"]):
        raise LayoutError(f"sky sunrise ({sky['sunrise']}) must be before sunset ({sky['sunset']})")
    return sky
