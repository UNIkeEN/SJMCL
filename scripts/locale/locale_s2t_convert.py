#!/usr/bin/env python3
"""
This script converts zh-Hans locale to zh-Hant by OpenCC.

Usage:
    pip install opencc
    python convert_locale.py
"""

import json
import os
from opencc import OpenCC

def convert_simplified_to_traditional(obj):
    if isinstance(obj, dict):
        return {key: convert_simplified_to_traditional(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_simplified_to_traditional(element) for element in obj]
    elif isinstance(obj, str):
        return converter.convert(obj)
    else:
        return obj

converter = OpenCC('s2twp')  # Conversion mode: 's2twp' (Simplified Chinese to Traditional Chinese (Taiwan Standard) with Taiwanese idiom)

script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(os.path.dirname(script_dir))

input_path = os.path.join(root_dir, 'src/locales/zh-Hans.json')
output_path = os.path.join(root_dir, 'src/locales/zh-Hant.json')

if not os.path.exists(input_path):
    print(f"Error: The input file '{input_path}' does not exist.")
    exit(1)

with open(input_path, 'r', encoding='utf-8') as f:
    simplified_data = json.load(f)

traditional_data = convert_simplified_to_traditional(simplified_data)

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(traditional_data, f, ensure_ascii=False, indent=2)

print("Conversion complete!")