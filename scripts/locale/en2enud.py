#!/usr/bin/env python3
"""
This script converts en locale to en-ud (upside down).

Usage:
    python en2enud.py
"""

import json
import os
import re

UPSIDE_DOWN_MAP = {
    'a': 'ɐ', 'b': 'q', 'c': 'ɔ', 'd': 'p', 'e': 'ǝ', 'f': 'ɟ', 'g': 'ᵷ', 'h': 'ɥ',
    'i': 'ᴉ', 'j': 'ɾ', 'k': 'ʞ', 'l': 'ꞁ', 'm': 'ɯ', 'n': 'u', 'o': 'o', 'p': 'd',
    'q': 'b', 'r': 'ɹ', 's': 's', 't': 'ʇ', 'u': 'n', 'v': 'ʌ', 'w': 'ʍ', 'x': 'x',
    'y': 'ʎ', 'z': 'z',
    'A': 'Ɐ', 'B': 'ᗺ', 'C': 'Ɔ', 'D': 'ᗡ', 'E': 'Ǝ', 'F': 'Ⅎ', 'G': '⅁', 'H': 'H',
    'I': 'I', 'J': 'ſ', 'K': 'ʞ', 'L': 'Ꞁ', 'M': 'W', 'N': 'N', 'O': 'O', 'P': 'Ԁ',
    'Q': 'Ὁ', 'R': 'ᴚ', 'S': 'S', 'T': '⟘', 'U': '∩', 'V': 'Λ', 'W': 'M', 'X': 'X',
    'Y': 'ʎ', 'Z': 'Z',
    '0': '0', '1': 'Ɩ', '2': 'ᘔ', '3': 'Ɛ', '4': 'ㄣ', '5': 'ϛ', '6': '9', '7': 'ㄥ',
    '8': '8', '9': '6',
    '_': '‾', ',': '\'', ';': '⸵', '.': '˙', '?': '¿', '!': '¡', '/': '\\', '\\': '/',
    '\'': ',', '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{'
}

def is_preserved(text):
    """Check if text should be preserved (URLs, deeplinks, etc.)"""
    return text.startswith(('http://', 'https://', 'ftp://', '//', 'sjmcl://', 'mailto:'))

def flip_text(text):
    """Flip text upside down, preserving {{}} template variables"""
    if not isinstance(text, str) or not text:
        return text
    
    if is_preserved(text):
        return text
    
    template_vars = []
    placeholder_base = '\uE000{}\uE001'
    
    def replace_template(match):
        template_vars.append(match.group(0))
        return placeholder_base.format(chr(0xE100 + len(template_vars) - 1))
    
    text_with_placeholders = re.sub(r'\{\{[^}]+\}\}', replace_template, text)
    flipped = ''.join(UPSIDE_DOWN_MAP.get(c, c) for c in text_with_placeholders)
    flipped = flipped[::-1]
    
    for i, template_var in enumerate(template_vars):
        placeholder = placeholder_base.format(chr(0xE100 + i))
        reversed_placeholder = placeholder[::-1]
        flipped = flipped.replace(reversed_placeholder, template_var)
    
    return flipped

def convert_to_upside_down(obj, existing_obj=None):
    """Recursively convert all strings in the object to upside down text"""
    if isinstance(obj, dict):
        existing_dict = existing_obj if isinstance(existing_obj, dict) else {}
        return {key: convert_to_upside_down(value, existing_dict.get(key)) for key, value in obj.items()}
    elif isinstance(obj, list):
        existing_list = existing_obj if isinstance(existing_obj, list) else []
        return [convert_to_upside_down(element, existing_list[i] if i < len(existing_list) else None) for i, element in enumerate(obj)]
    elif isinstance(obj, str):
        if is_preserved(obj):
            if existing_obj and isinstance(existing_obj, str) and is_preserved(existing_obj):
                return existing_obj
            return obj
        return flip_text(obj)
    else:
        return obj

script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(os.path.dirname(script_dir))

input_path = os.path.join(root_dir, 'src/locales/en.json')
output_path = os.path.join(root_dir, 'src/locales/en-ud.json')

if not os.path.exists(input_path):
    print(f"Error: The input file '{input_path}' does not exist.")
    exit(1)

existing_upside_down_data = {}
if os.path.exists(output_path):
    with open(output_path, 'r', encoding='utf-8') as f:
        existing_upside_down_data = json.load(f)

with open(input_path, 'r', encoding='utf-8') as f:
    english_data = json.load(f)

upside_down_data = convert_to_upside_down(english_data, existing_upside_down_data)

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(upside_down_data, f, ensure_ascii=False, indent=2)

print("Conversion complete! en.json has been converted to en-ud.json")
