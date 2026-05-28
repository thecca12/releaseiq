"""
Greek Codes parser — reads Datasource/Greek_Codes/GreekCode_all.txt
Format: C header #define macros: #define NAME VALUE [//comment]

Categories detected from file:
  GC_HISTORICAL_MCXSX_*    MCX-SX historical (token master, orders, trades)
  GC_PRODUCT_*             Product login/logoff (5401, 5403)
  GC_MARKET_*              Market operations
  GC_LOGIN/LOGOFF_BASKET   Basket operations
  GC_GAB_*                 Guaranteed Arbitrage Block
  IC_GREEK_*               Greek product internals
  IC_HISTORICAL_SEQ_*      Historical sequence
  EEC_*                    Exchange error codes
  EQ/FO/COM/DGCX_BCAST_*  Broadcast changed
  BC_*                     Broadcast codes
  IC_OFFLINE_*             Offline orders
  GREEK_MANDETORY_*        Mandatory password operations
"""
import logging
import re
from pathlib import Path
from typing import Any, Dict, List
from app.services.datasource.base_parser import BaseParser

logger = logging.getLogger(__name__)

EXCHANGE_MAP = [
    ("MCXSX", "MCX-SX"), ("MCX", "MCX"),
    ("NSE", "NSE"), ("BSE", "BSE"), ("DGCX", "DGCX"),
]
CATEGORY_MAP = [
    ("HISTORICAL", "Historical Data"), ("TOKEN_MASTER", "Token Master"),
    ("PENDINGORDERS", "Pending Orders"), ("GIVE_UP", "Give Up Trade"),
    ("BASKET", "Basket Order"), ("GAB", "Guaranteed Arbitrage Block"),
    ("LICENSE", "License Management"), ("OFFLINE", "Offline Order"),
    ("BCAST", "Broadcast"), ("BROADCAST", "Broadcast"),
    ("MKTWATCH", "Market Watch"), ("MARKET", "Market Status"),
    ("ORDER", "Order Management"), ("TRADE", "Trade"),
    ("PRODUCT", "Product Config"), ("LOGIN", "Login"),
    ("LOGOFF", "Logoff"), ("OPENCLOSE", "Open/Close"),
    ("BESTBID", "Best Bid/Ask"), ("PWD", "Password"),
    ("MANDETORY", "Mandatory"), ("PRICE_FREEZE", "Price Freeze"),
    ("QUANTITY_FREEZE", "Quantity Freeze"),
]
SEGMENT_MAP = [
    ("_EQ_", "Equity"), ("EQ_", "Equity"),
    ("_FO_", "F&O"), ("FO_", "F&O"),
    ("_SPD_", "Spread"), ("COM_", "Commodity"), ("_COM_", "Commodity"),
]

class GreekCodesParser(BaseParser):
    def get_source_name(self) -> str:
        return "Greek Codes"

    def parse(self) -> List[Dict[str, Any]]:
        codes = []
        for folder_name in ["Greek_Codes", "greek_codes"]:
            folder_path = self.root / folder_name
            if not folder_path.exists():
                continue
            for txt_file in folder_path.glob("*.txt"):
                codes.extend(self._parse_defines(txt_file))
            break
        logger.info(f"GreekCodesParser: parsed {len(codes)} greek codes")
        return codes

    def _parse_defines(self, path: Path) -> List[Dict[str, Any]]:
        codes = []
        content = self._safe_read(path)
        # Match: #define NAME  VALUE  [//optional comment]
        pattern = re.compile(r'#define\s+(\w+)\s+(\d+)\s*(?://(.*))?', re.M)
        for m in pattern.finditer(content):
            name    = m.group(1).strip()
            value   = m.group(2).strip()
            comment = (m.group(3) or "").strip()
            if len(name) < 3:
                continue
            codes.append({
                "greek_code":   name,
                "exchange":     self._get_exchange(name),
                "product_type": self._get_category(name),
                "description":  comment if comment else self._build_description(name),
                "segment":      self._get_segment(name),
                "series":       value,
                "value":        value,
                "message_type": self._get_msg_type(name),
            })
        return codes

    def _get_exchange(self, name: str) -> str:
        u = name.upper()
        for token, exch in EXCHANGE_MAP:
            if token in u:
                return exch
        return "MULTI"

    def _get_category(self, name: str) -> str:
        u = name.upper()
        for token, cat in CATEGORY_MAP:
            if token in u:
                return cat
        return "General"

    def _get_segment(self, name: str) -> str:
        for token, seg in SEGMENT_MAP:
            if token in name.upper():
                return seg
        return "General"

    def _get_msg_type(self, name: str) -> str:
        u = name.upper()
        if u.endswith("_REQ"):     return "Request"
        if u.endswith(("_RES", "_RESP")): return "Response"
        if u.endswith("_HEADER"): return "Header"
        if u.endswith("_DATA"):   return "Data"
        if u.endswith("_TRAILER"): return "Trailer"
        if u.endswith("_STATUS"): return "Status"
        return "Event"

    def _build_description(self, name: str) -> str:
        for prefix in ("GC_", "GIC_", "IC_GREEK_", "IC_", "BC_", "EEC_", "GREEK_"):
            if name.upper().startswith(prefix):
                name = name[len(prefix):]
                break
        return name.replace("_", " ").title()
