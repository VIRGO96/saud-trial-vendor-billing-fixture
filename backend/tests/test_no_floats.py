"""AST-based static analysis test enforcing ZERO floating point usage in financial paths."""

import ast
from pathlib import Path
import pytest


class FloatUsageVisitor(ast.NodeVisitor):
    def __init__(self, filename: str):
        self.filename = filename
        self.violations: list[str] = []
        self.current_func: str | None = None

    def visit_FunctionDef(self, node: ast.FunctionDef):
        # can_parse returns a heuristic confidence float [0.0, 1.0], not financial data
        if node.name == "can_parse":
            return
        prev_func = self.current_func
        self.current_func = node.name
        self.generic_visit(node)
        self.current_func = prev_func

    def visit_Call(self, node: ast.Call):
        if isinstance(node.func, ast.Name) and node.func.id == "float":
            self.violations.append(
                f"{self.filename}:{node.lineno} (in {self.current_func}): Call to built-in 'float()' detected."
            )
        self.generic_visit(node)

    def visit_Constant(self, node: ast.Constant):
        if isinstance(node.value, float):
            self.violations.append(
                f"{self.filename}:{node.lineno} (in {self.current_func}): Float literal {node.value!r} detected."
            )
        self.generic_visit(node)


def get_financial_python_files():
    app_dir = Path(__file__).resolve().parent.parent / "app"
    targets = [
        app_dir / "parsers" / "csv_parser.py",
        app_dir / "parsers" / "pdf_parser.py",
        app_dir / "parsers" / "base.py",
        app_dir / "services" / "comparison.py",
        app_dir / "db" / "models.py",
        app_dir / "db" / "custom_types.py",
    ]
    return [t for t in targets if t.is_file()]


def test_zero_floats_in_financial_paths():
    """Ensure that parsers, comparison logic, models, and custom types contain ZERO floats in financial paths."""
    files = get_financial_python_files()
    assert len(files) >= 5, "Should find core financial application files"

    all_violations: list[str] = []
    for file_path in files:
        with open(file_path, "r", encoding="utf-8-sig") as f:
            source = f.read()
        tree = ast.parse(source, filename=str(file_path))
        visitor = FloatUsageVisitor(file_path.name)
        visitor.visit(tree)
        all_violations.extend(visitor.violations)

    assert not all_violations, (
        "Detected floating point operations in financial logic! "
        "Financial data must strictly use decimal.Decimal.\n"
        + "\n".join(all_violations)
    )
