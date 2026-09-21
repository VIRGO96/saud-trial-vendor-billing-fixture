from typing import List, Optional, Tuple
from app.parsers.base import BaseParser, ParseError, ParseResult
from app.parsers.csv_parser import SherwebCSVParser
from app.parsers.pdf_parser import PowerDMARCPDFParser

class ParserRegistry:
    def __init__(self):
        self._parsers: List[BaseParser] = []

    def register(self, parser: BaseParser):
        self._parsers.append(parser)

    def get_best_parser(self, filename: str, content: bytes) -> Tuple[BaseParser, float]:
        best_parser: Optional[BaseParser] = None
        best_confidence: float = 0.0

        for parser in self._parsers:
            try:
                confidence = parser.can_parse(filename, content)
                if confidence > best_confidence:
                    best_confidence = confidence
                    best_parser = parser
            except Exception:
                continue

        if not best_parser or best_confidence < 0.2:
            raise ParseError(
                f"Unsupported file format or unrecognized invoice structure for '{filename}'. "
                "Supported formats: Sherweb CSV, PowerDMARC PDF."
            )
        return best_parser, best_confidence

    def parse(self, filename: str, content: bytes) -> ParseResult:
        parser, _ = self.get_best_parser(filename, content)
        return parser.parse(content, filename=filename)

# Global registry instance
default_registry = ParserRegistry()
default_registry.register(SherwebCSVParser())
default_registry.register(PowerDMARCPDFParser())