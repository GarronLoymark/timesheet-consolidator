#!/usr/bin/env python3
"""Caso 8: verifica que un .xlsx recalculado no tenga errores de fórmula.
Lee los valores cacheados y falla si encuentra errores (#REF!, #VALUE!, etc.).
Uso: python3 check_excel.py <archivo.xlsx>
"""
import sys
from pathlib import Path

import openpyxl

ERRORS = {"#REF!", "#VALUE!", "#DIV/0!", "#NAME?", "#N/A", "#NUM!", "#NULL!", "#ERROR!"}


def main(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    found = []
    for ws in wb.worksheets:
        for row in ws.iter_rows():
            for c in row:
                if isinstance(c.value, str) and c.value.strip() in ERRORS:
                    found.append(f"{ws.title}!{c.coordinate} = {c.value}")
    if found:
        print(f"✗ {len(found)} error(es) de fórmula en {path}:")
        for f in found[:50]:
            print("  ", f)
        sys.exit(1)
    print(f"✓ Sin errores de fórmula en {path}")


if __name__ == "__main__":
    if len(sys.argv) < 2 or not Path(sys.argv[1]).exists():
        print("Uso: python3 check_excel.py <archivo.xlsx>")
        sys.exit(2)
    main(sys.argv[1])
