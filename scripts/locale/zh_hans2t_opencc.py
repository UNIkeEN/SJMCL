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

def is_url(text):
    return text.startswith(('http://', 'https://', 'ftp://', '//'))
def merge_preserve_urls(new_obj, existing_obj):
    if isinstance(new_obj, dict) and isinstance(existing_obj, dict):
        result = {}
        for key in new_obj:
            if key in existing_obj:
                result[key] = merge_preserve_urls(new_obj[key], existing_obj[key])
            else:
                result[key] = new_obj[key]
        for key in existing_obj:
            if key not in result:
                result[key] = existing_obj[key]
        return result
    elif isinstance(new_obj, list) and isinstance(existing_obj, list):
        return new_obj
    elif isinstance(new_obj, str) and isinstance(existing_obj, str):
        if is_url(new_obj) and is_url(existing_obj):
            return existing_obj
        return new_obj
    else:
        return new_obj
def convert_simplified_to_traditional(obj):
    if isinstance(obj, dict):
        return {key: convert_simplified_to_traditional(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_simplified_to_traditional(element) for element in obj]
    elif isinstance(obj, str):
        if is_url(obj):
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

converted_data = convert_simplified_to_traditional(simplified_data)
traditional_data = merge_preserve_urls(converted_data, existing_traditional_data)

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(traditional_data, f, ensure_ascii=False, indent=2)

print("Conversion complete!")