from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Dict, List, Optional

class ParseError(Exception):
    """Raised when a document cannot be parsed into line items."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

@dataclass
class ParseWarning:
    row_index: Optional[int]
    message: str
    severity: str = "warning" # warning, info, error

@dataclass
class ParsedLineItem:
    row_index: int
    account: str
    sku: Optional[str]
    description: str
    match_key: str
    quantity: Decimal
    list_price: Optional[Decimal]
    unit_cost: Decimal
    line_total: Decimal
    kind: str # 'charge', 'credit', 'info', 'usage'
    raw_data: Dict[str, Any] = field(default_factory=dict)

@dataclass
class InvoiceMeta:
    invoice_number: Optional[str]
    invoice_date: Optional[str] # YYYY-MM-DD or raw
    period_from: Optional[str]
    period_to: Optional[str]
    period_label: str # YYYY-MM default
    currency: str
    declared_total: Optional[Decimal]
    source_format: str # 'csv' or 'pdf'

@dataclass
class ParseResult:
    parser_name: str
    parser_version: str
    vendor_guess: str
    invoice_meta: InvoiceMeta
    line_items: List[ParsedLineItem]
    warnings: List[ParseWarning] = field(default_factory=list)

    @property
    def computed_total(self) -> Decimal:
        return sum((item.line_total for item in self.line_items), Decimal('0'))

class BaseParser(ABC):
    name: str = "base"
    version: str = "1.0"

    @abstractmethod
    def can_parse(self, filename: str, content: bytes) -> float:
        """Return confidence score between 0.0 and 1.0."""
        pass

    @abstractmethod
    def parse(self, content: bytes, filename: str = "") -> ParseResult:
        """Parse raw bytes into normalized ParseResult."""
        pass
