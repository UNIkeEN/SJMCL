#!/usr/bin/env python3
"""
This script converts zh-Hans locale to zh-Hant by OpenCC.

Usage:
    pip install opencc
    python zh_hans2t_opencc.py
"""

import json
import os
from opencc import OpenCC

def is_preserved(text):
    # URLs and Deeplinks
    return text.startswith(('http://', 'https://', 'ftp://', '//', 'sjmcl://', 'mailto:'))

def convert_simplified_to_traditional(obj, existing_obj=None):
    if isinstance(obj, dict):
        existing_dict = existing_obj if isinstance(existing_obj, dict) else {}
        return {key: convert_simplified_to_traditional(value, existing_dict.get(key)) for key, value in obj.items()}
    elif isinstance(obj, list):
        existing_list = existing_obj if isinstance(existing_obj, list) else []
        return [convert_simplified_to_traditional(element, existing_list[i] if i < len(existing_list) else None) for i, element in enumerate(obj)]
    elif isinstance(obj, str):
        if is_preserved(obj):
            if existing_obj and isinstance(existing_obj, str) and is_preserved(existing_obj):
                return existing_obj
            return obj
        return converter.convert(obj)
    else:
        return obj

converter = OpenCC('s2twp')  # Conversion mode: 's2twp', Simplified Chinese to Traditional Chinese (Taiwan Standard) with Taiwanese idiom

script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(os.path.dirname(script_dir))

input_path = os.path.join(root_dir, 'src/locales/zh-Hans.json')
output_path = os.path.join(root_dir, 'src/locales/zh-Hant.json')

if not os.path.exists(input_path):
    print(f"Error: The input file '{input_path}' does not exist.")
    exit(1)

existing_traditional_data = {}
if os.path.exists(output_path):
    with open(output_path, 'r', encoding='utf-8') as f:
        existing_traditional_data = json.load(f)

with open(input_path, 'r', encoding='utf-8') as f:
    simplified_data = json.load(f)

traditional_data = convert_simplified_to_traditional(simplified_data, existing_traditional_data)

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(traditional_data, f, ensure_ascii=False, indent=2)

print("Conversion complete!")