import decimal
from sqlalchemy import TypeDecorator, String

class DecimalString(TypeDecorator):
    """
    Stores Decimals as strings in SQLite (preserving exact precision without float artifacts)
    and converts back to Python Decimal objects.
    """
    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, decimal.Decimal):
            return str(value)
        if isinstance(value, (int, float, str)):
            return str(decimal.Decimal(str(value)))
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None or value == '':
            return None
        return decimal.Decimal(str(value))
