"""
Knowledge Base endpoints — all data served from DataSourceManager (real files).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.utils.dependencies import CurrentUser

router = APIRouter(prefix="/knowledge", tags=["Knowledge Base"])


# ---------------------------------------------------------------------------
# Shared schemas
# ---------------------------------------------------------------------------


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Error Codes
# ---------------------------------------------------------------------------


class ErrorCode(BaseModel):
    code: str
    category: str
    description: str
    severity: str  # info | warning | error | critical
    resolution: str
    examples: list[str] = []


_ERROR_CODES: list[dict] = [
    {"code": "RMS-001", "category": "Risk Management", "description": "Order quantity exceeds maximum allowed", "severity": "error", "resolution": "Reduce order quantity to within configured RMS limits.", "examples": ["Order for 10,000 shares rejected; max is 5,000"]},
    {"code": "RMS-002", "category": "Risk Management", "description": "Daily loss limit breached", "severity": "critical", "resolution": "Contact risk desk immediately. Trading will be suspended until reset.", "examples": ["P&L -$500,000 exceeds daily limit of -$400,000"]},
    {"code": "RMS-003", "category": "Risk Management", "description": "Concentration limit exceeded", "severity": "warning", "resolution": "Diversify holdings or request limit increase from risk manager.", "examples": []},
    {"code": "FIX-001", "category": "FIX Protocol", "description": "Invalid MsgType (35)", "severity": "error", "resolution": "Verify FIX message type against specification.", "examples": ["35=Z is not a valid FIX 4.4 message type"]},
    {"code": "FIX-002", "category": "FIX Protocol", "description": "Sequence number gap detected", "severity": "warning", "resolution": "Send ResendRequest (2) for missing sequence numbers.", "examples": ["Expected 1042, received 1050"]},
    {"code": "FIX-003", "category": "FIX Protocol", "description": "Logon rejected – invalid credentials", "severity": "critical", "resolution": "Verify SenderCompID/TargetCompID and password (554).", "examples": []},
    {"code": "FIX-004", "category": "FIX Protocol", "description": "Duplicate ClOrdID", "severity": "error", "resolution": "Ensure ClOrdID (11) is unique per session.", "examples": ["ClOrdID ORD-12345 already exists in this session"]},
    {"code": "FIX-005", "category": "FIX Protocol", "description": "Order rejected by exchange", "severity": "error", "resolution": "Check rejection reason in tag 58 (Text) of ExecutionReport.", "examples": ["ExecType=8, OrdStatus=8, Text=Price out of range"]},
    {"code": "OMS-001", "category": "Order Management", "description": "Order not found", "severity": "warning", "resolution": "Verify ClOrdID or OrderID is correct.", "examples": []},
    {"code": "OMS-002", "category": "Order Management", "description": "Cancel request for filled order", "severity": "warning", "resolution": "Check order status before sending cancel request.", "examples": []},
    {"code": "AUTH-001", "category": "Authentication", "description": "JWT token expired", "severity": "warning", "resolution": "Refresh the access token using the /auth/refresh endpoint.", "examples": []},
    {"code": "AUTH-002", "category": "Authentication", "description": "Insufficient permissions", "severity": "error", "resolution": "Request the required role from your system administrator.", "examples": []},
    {"code": "DB-001", "category": "Database", "description": "Connection pool exhausted", "severity": "critical", "resolution": "Check for connection leaks. Increase pool size in configuration.", "examples": []},
    {"code": "SYS-001", "category": "System", "description": "Disk space low", "severity": "warning", "resolution": "Archive old log files. Add storage capacity.", "examples": ["Disk at 92% capacity"]},
]


@router.get("/error-codes", summary="Get error code reference (datasource)")
async def get_error_codes(
    current_user: CurrentUser,
    category: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedResponse:
    """Return the error code reference catalogue from DataSourceManager."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    codes = ds.get_error_codes(module=module, severity=severity)

    if category:
        codes = [c for c in codes if c.get("category", "").lower() == category.lower()]
    if search:
        s = search.lower()
        codes = [c for c in codes if s in c.get("code", "").lower() or s in c.get("description", "").lower()]

    # Fallback to built-in list if datasource empty
    if not codes:
        codes = list(_ERROR_CODES)
        if category:
            codes = [c for c in codes if c["category"].lower() == category.lower()]
        if severity:
            codes = [c for c in codes if c["severity"].lower() == severity.lower()]
        if search:
            s = search.lower()
            codes = [c for c in codes if s in c["code"].lower() or s in c["description"].lower()]

    total = len(codes)
    start = (page - 1) * page_size
    items = codes[start: start + page_size]
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size)


# ---------------------------------------------------------------------------
# Circulars
# ---------------------------------------------------------------------------


class Circular(BaseModel):
    id: str
    circular_number: str
    title: str
    issued_by: str
    date: str
    category: str
    summary: str
    url: Optional[str] = None
    tags: list[str] = []


_CIRCULARS: list[dict] = [
    {
        "id": "circ-001",
        "circular_number": "NSE/COMP/42823",
        "title": "Amendment to FIX Protocol Specifications – Version 4.4 Mandatory",
        "issued_by": "NSE",
        "date": "2025-01-15",
        "category": "FIX Protocol",
        "summary": "All members must upgrade to FIX 4.4 by March 31, 2025. FIX 4.2 sessions will be discontinued.",
        "url": "https://nseindia.com/circulars/42823",
        "tags": ["fix", "mandatory", "upgrade"],
    },
    {
        "id": "circ-002",
        "circular_number": "BSE/IT/2025/01",
        "title": "New RMS Parameters for Algorithmic Trading",
        "issued_by": "BSE",
        "date": "2025-02-01",
        "category": "Risk Management",
        "summary": "Updated concentration limits and order-to-trade ratios effective April 1, 2025.",
        "url": None,
        "tags": ["rms", "algo", "limits"],
    },
    {
        "id": "circ-003",
        "circular_number": "SEBI/HO/MRD/2025/10",
        "title": "Cybersecurity Framework for Market Infrastructure Institutions",
        "issued_by": "SEBI",
        "date": "2025-03-10",
        "category": "Compliance",
        "summary": "Mandatory cybersecurity audit and penetration testing for all trading systems by June 30, 2025.",
        "url": "https://sebi.gov.in/circulars/2025/10",
        "tags": ["security", "compliance", "audit"],
    },
    {
        "id": "circ-004",
        "circular_number": "NSE/COMP/43100",
        "title": "Co-location Facility Upgrade – Latency Improvements",
        "issued_by": "NSE",
        "date": "2025-04-05",
        "category": "Infrastructure",
        "summary": "New co-location racks available with 10 Gbps connectivity. Application window open until May 15.",
        "url": None,
        "tags": ["colocation", "latency", "infrastructure"],
    },
]


@router.get("/circulars", summary="Get exchange circulars (datasource)")
async def get_circulars(
    current_user: CurrentUser,
    issued_by: Optional[str] = Query(None),
    exchange: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedResponse:
    """Return the list of regulatory circulars from DataSourceManager."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    exch = issued_by or exchange
    circulars = ds.get_circulars(exchange=exch, search=search)

    # Normalize to a unified output shape
    output = []
    for c in circulars:
        exch = c.get("exchange", "")
        output.append({
            "id": c.get("id"),
            "exchange": exch,               # used by frontend CircularsPage
            "circular_no": c.get("circular_no", ""),
            "circular_number": c.get("circular_no", ""),
            "title": c.get("subject", c.get("filename", "")),
            "subject": c.get("subject", c.get("filename", "")),
            "issued_by": exch,
            "date": c.get("date", ""),
            "category": "Exchange Circular",
            "body": c.get("body", ""),     # full body for frontend
            "summary": c.get("body", "")[:300],
            "url": None,
            "tags": [exch.lower()] if exch else [],
            "filename": c.get("filename"),
        })

    # Fallback to built-in list if datasource empty
    if not output:
        output = list(_CIRCULARS)
        if issued_by:
            output = [c for c in output if c.get("issued_by", "").lower() == issued_by.lower()]
        if category:
            output = [c for c in output if c.get("category", "").lower() == category.lower()]
        if search:
            s = search.lower()
            output = [c for c in output if s in c.get("title", "").lower() or s in c.get("summary", "").lower()]

    total = len(output)
    start = (page - 1) * page_size
    return PaginatedResponse(items=output[start: start + page_size], total=total, page=page, page_size=page_size)


# ---------------------------------------------------------------------------
# Flags
# ---------------------------------------------------------------------------


class TradingFlag(BaseModel):
    flag: str
    name: str
    description: str
    values: dict
    default: str
    impact: str


_FLAGS: list[dict] = [
    {
        "flag": "ALGO_TRADING_ENABLED",
        "name": "Algorithmic Trading",
        "description": "Enables/disables algorithmic order submission.",
        "values": {"true": "Algo orders accepted", "false": "Manual orders only"},
        "default": "true",
        "impact": "High – affects all algo order processing",
    },
    {
        "flag": "SHORT_SELLING_ALLOWED",
        "name": "Short Selling",
        "description": "Controls whether short sell orders are accepted.",
        "values": {"true": "Short selling enabled", "false": "Long only mode"},
        "default": "true",
        "impact": "Medium",
    },
    {
        "flag": "MARKET_ORDERS_ENABLED",
        "name": "Market Orders",
        "description": "Toggles acceptance of market (un-priced) orders.",
        "values": {"true": "Market orders accepted", "false": "Limit orders only"},
        "default": "true",
        "impact": "High – affects order flow during volatile sessions",
    },
    {
        "flag": "PRE_TRADE_RISK_CHECK",
        "name": "Pre-Trade Risk Check",
        "description": "Whether RMS validation runs before order submission.",
        "values": {"true": "Full pre-trade checks", "false": "Bypass RMS (use with caution)"},
        "default": "true",
        "impact": "Critical – disabling may violate regulatory requirements",
    },
    {
        "flag": "KILL_SWITCH",
        "name": "Kill Switch",
        "description": "Emergency flag to halt all order activity immediately.",
        "values": {"false": "Trading active", "true": "ALL trading halted"},
        "default": "false",
        "impact": "Critical – cancels all open orders and blocks new ones",
    },
    {
        "flag": "DARK_POOL_ROUTING",
        "name": "Dark Pool Routing",
        "description": "Enables routing of large orders to dark pool venues.",
        "values": {"true": "Dark pool routing active", "false": "Lit exchange only"},
        "default": "false",
        "impact": "Medium",
    },
]


@router.get("/flags", summary="Get trading flag definitions (datasource)")
async def get_flags(
    current_user: CurrentUser,
    flag_type: Optional[str] = Query(None),
    section: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> PaginatedResponse:
    """Return system and trading flag definitions from DataSourceManager."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    flags = ds.get_flags(flag_type=flag_type, section=section)

    if search:
        s = search.lower()
        flags = [f for f in flags if s in f.get("name", "").lower() or s in f.get("description", "").lower()]

    # Fallback to built-in list if datasource empty
    if not flags:
        flags = list(_FLAGS)
        if search:
            s = search.lower()
            flags = [f for f in flags if s in f["flag"].lower() or s in f["description"].lower()]

    total = len(flags)
    start = (page - 1) * page_size
    return PaginatedResponse(items=flags[start: start + page_size], total=total, page=page, page_size=page_size)


# ---------------------------------------------------------------------------
# Greek Codes
# ---------------------------------------------------------------------------


class GreekCode(BaseModel):
    code: str
    module: str
    description: str
    parameters: list[str]
    notes: str


_GREEK_CODES: list[dict] = [
    {
        "code": "GS-OMS-001",
        "module": "Order Management",
        "description": "New order submitted to exchange via FIX gateway",
        "parameters": ["ClOrdID", "Symbol", "Side", "Qty", "Price", "OrdType"],
        "notes": "ClOrdID must be unique per session. Auto-incremented by OMS.",
    },
    {
        "code": "GS-RMS-010",
        "module": "Risk Management",
        "description": "Pre-trade risk check passed – order forwarded",
        "parameters": ["OrderID", "CheckedBy", "Timestamp"],
        "notes": "Logged at INFO level in RMS audit log.",
    },
    {
        "code": "GS-RMS-011",
        "module": "Risk Management",
        "description": "Pre-trade risk check failed – order blocked",
        "parameters": ["OrderID", "FailReason", "Limit", "ActualValue"],
        "notes": "Client receives ExecutionReport with ExecType=8 (Rejected).",
    },
    {
        "code": "GS-FIX-100",
        "module": "FIX Gateway",
        "description": "FIX session logon initiated",
        "parameters": ["SenderCompID", "TargetCompID", "HeartBtInt"],
        "notes": "HeartBtInt configured in session settings (default: 30s).",
    },
    {
        "code": "GS-FIX-101",
        "module": "FIX Gateway",
        "description": "FIX session logout completed gracefully",
        "parameters": ["SenderCompID", "TargetCompID", "LastSeqNum"],
        "notes": "SeqNum stored for next session resume.",
    },
    {
        "code": "GS-RPT-200",
        "module": "Reporting",
        "description": "End-of-day trade report generated",
        "parameters": ["ReportDate", "TradeCount", "TurnoverValue", "OutputPath"],
        "notes": "Runs at 18:30 IST daily. Output stored in /reports/eod/.",
    },
]


@router.get("/greek-codes", summary="Get GreekSoft instrument codes (datasource)")
async def get_greek_codes(
    current_user: CurrentUser,
    exchange: Optional[str] = Query(None),
    product_type: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> PaginatedResponse:
    """Return instrument (greek) codes from DataSourceManager."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    codes = ds.get_greek_codes(exchange=exchange, product_type=product_type)

    if search:
        s = search.lower()
        codes = [
            c for c in codes
            if s in c.get("greek_code", "").lower()
            or s in c.get("description", "").lower()
            or s in c.get("exchange", "").lower()
        ]

    # Fallback to built-in list if datasource empty
    if not codes:
        built_in = list(_GREEK_CODES)
        if module:
            built_in = [c for c in built_in if c["module"].lower() == module.lower()]
        if search:
            s = search.lower()
            built_in = [c for c in built_in if s in c["code"].lower() or s in c["description"].lower()]
        total = len(built_in)
        start = (page - 1) * page_size
        return PaginatedResponse(items=built_in[start: start + page_size], total=total, page=page, page_size=page_size)

    total = len(codes)
    start = (page - 1) * page_size
    return PaginatedResponse(items=codes[start: start + page_size], total=total, page=page, page_size=page_size)


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------


class TestCase(BaseModel):
    id: str
    title: str
    module: str
    category: str  # smoke | regression | integration | performance
    priority: str  # P0 | P1 | P2 | P3
    steps: list[str]
    expected_result: str
    tags: list[str] = []


_TEST_CASES: list[dict] = [
    {
        "id": "TC-001",
        "title": "FIX Logon – Valid Credentials",
        "module": "FIX Gateway",
        "category": "smoke",
        "priority": "P0",
        "steps": [
            "Send Logon (A) with valid SenderCompID and password",
            "Verify Logon response received from counterparty",
            "Verify HeartBtInt is acknowledged",
        ],
        "expected_result": "Session established; both sides logged on successfully.",
        "tags": ["fix", "logon", "smoke"],
    },
    {
        "id": "TC-002",
        "title": "New Order Single – Buy Limit",
        "module": "Order Management",
        "category": "regression",
        "priority": "P0",
        "steps": [
            "Send NewOrderSingle (D) with Side=1 (Buy), OrdType=2 (Limit), price and qty",
            "Verify ExecutionReport (8) received with ExecType=0 (New), OrdStatus=0 (New)",
            "Verify ClOrdID matches",
        ],
        "expected_result": "Order acknowledged; OrdStatus=New.",
        "tags": ["fix", "order", "buy", "regression"],
    },
    {
        "id": "TC-003",
        "title": "RMS – Order Quantity Limit Breach",
        "module": "Risk Management",
        "category": "regression",
        "priority": "P1",
        "steps": [
            "Configure RMS max qty to 1000",
            "Submit order for 1500 shares",
            "Verify order is rejected",
            "Verify rejection reason contains RMS-001",
        ],
        "expected_result": "Order rejected with ExecType=8 (Rejected). Error code RMS-001 in Text field.",
        "tags": ["rms", "rejection", "regression"],
    },
    {
        "id": "TC-004",
        "title": "Order Modify – Price Change",
        "module": "Order Management",
        "category": "regression",
        "priority": "P1",
        "steps": [
            "Submit NewOrderSingle and receive New acknowledgement",
            "Submit OrderCancelReplaceRequest (G) with new price",
            "Verify ExecutionReport with ExecType=5 (Replaced)",
        ],
        "expected_result": "Order replaced; new price confirmed in ExecutionReport.",
        "tags": ["fix", "modify", "regression"],
    },
    {
        "id": "TC-005",
        "title": "Kill Switch – Halt All Trading",
        "module": "Risk Management",
        "category": "smoke",
        "priority": "P0",
        "steps": [
            "Enable KILL_SWITCH flag via admin API",
            "Attempt to submit a new order",
            "Verify order is immediately rejected",
            "Disable KILL_SWITCH and verify trading resumes",
        ],
        "expected_result": "All orders rejected while kill switch is active. Trading resumes when disabled.",
        "tags": ["kill-switch", "risk", "smoke", "p0"],
    },
    {
        "id": "TC-006",
        "title": "Sequence Gap – ResendRequest",
        "module": "FIX Gateway",
        "category": "integration",
        "priority": "P1",
        "steps": [
            "Simulate network drop causing sequence gap",
            "Verify system detects gap via ResendRequest (2)",
            "Verify missing messages are replayed",
            "Verify session resumes normal operation",
        ],
        "expected_result": "Session recovers gracefully; no order state inconsistencies.",
        "tags": ["fix", "recovery", "sequence", "integration"],
    },
]


@router.get("/test-cases", summary="Get test cases (datasource)")
async def get_test_cases(
    current_user: CurrentUser,
    module: Optional[str] = Query(None),
    test_type: Optional[str] = Query(None, alias="type"),
    test_status: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = Query(None),
    automation: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedResponse:
    """Return test cases from DataSourceManager regression suite."""
    from app.services.datasource.manager import get_datasource_manager
    ds = get_datasource_manager()
    cases = ds.get_test_cases(module=module, status=test_status, test_type=test_type, priority=priority)

    if automation is not None:
        cases = [c for c in cases if c.get("is_automated") == automation]
    if search:
        s = search.lower()
        cases = [c for c in cases if s in c.get("test_name", "").lower() or s in c.get("test_id", "").lower()]

    # Fallback to built-in list if datasource empty
    if not cases:
        built_in = list(_TEST_CASES)
        if module:
            built_in = [c for c in built_in if c["module"].lower() == module.lower()]
        if priority:
            built_in = [c for c in built_in if c["priority"].upper() == priority.upper()]
        if search:
            s = search.lower()
            built_in = [c for c in built_in if s in c["title"].lower()]
        total = len(built_in)
        start = (page - 1) * page_size
        return PaginatedResponse(items=built_in[start: start + page_size], total=total, page=page, page_size=page_size)

    total = len(cases)
    start = (page - 1) * page_size
    return PaginatedResponse(items=cases[start: start + page_size], total=total, page=page, page_size=page_size)
