#!/usr/bin/env python3
"""
This script converts Simplified Chinese text in a JSON file to Traditional Chinese text.

Usage:
    python convert_locale.py

Description:
    The script reads a source JSON file containing Simplified Chinese text, converts the text to Traditional Chinese, 
    and writes the result to a new JSON file. It uses the OpenCC library for conversion and recursively processes all 
    strings within nested dictionaries and lists in the JSON data.

Parameters:
    None. The script uses a predefined configuration:
        - Input file: 'src/locales/zh-Hans.json' (Simplified Chinese)
        - Output file: 'src/locales/zh-Hant.json' (Traditional Chinese)
        - Conversion mode: 's2twp' (converts Simplified Chinese to Traditional Chinese with Hong Kong and Macau extensions)

Dependencies:
    opencc: A library for Chinese conversion between Simplified and Traditional characters.
            Install it via pip: pip install opencc

Note:
    - Ensure the script is located in the correct directory structure relative to the source JSON file.
    - The script assumes that the input JSON file uses UTF-8 encoding.
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

converter = OpenCC('s2twp')

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