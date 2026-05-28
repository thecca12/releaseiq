"""
FIX Protocol Parser.

Parses raw FIX 4.x / 5.0 messages and session logs, reconstructs order
lifecycles, detects anomalies, and generates human-readable RCA summaries.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional


# ---------------------------------------------------------------------------
# FIX tag dictionaries
# ---------------------------------------------------------------------------

MSG_TYPES: dict[str, str] = {
    "0": "Heartbeat",
    "1": "TestRequest",
    "2": "ResendRequest",
    "3": "Reject",
    "4": "SequenceReset",
    "5": "Logout",
    "8": "ExecutionReport",
    "A": "Logon",
    "D": "NewOrderSingle",
    "F": "OrderCancelRequest",
    "G": "OrderCancelReplaceRequest",
    "V": "MarketDataRequest",
    "W": "MarketDataSnapshotFullRefresh",
    "j": "BusinessMessageReject",
}

EXEC_TYPES: dict[str, str] = {
    "0": "New",
    "1": "PartialFill",
    "2": "Fill",
    "3": "DoneForDay",
    "4": "Canceled",
    "5": "Replaced",
    "6": "PendingCancel",
    "7": "Stopped",
    "8": "Rejected",
    "9": "Suspended",
    "A": "PendingNew",
    "C": "Expired",
    "D": "Restated",
    "E": "PendingReplace",
    "F": "Trade",
    "H": "TradeCorrect",
    "I": "TradeCancel",
    "J": "OrderStatus",
}

ORD_STATUS: dict[str, str] = {
    "0": "New",
    "1": "PartiallyFilled",
    "2": "Filled",
    "3": "DoneForDay",
    "4": "Canceled",
    "5": "Replaced",
    "6": "PendingCancel",
    "7": "Stopped",
    "8": "Rejected",
    "9": "Suspended",
    "A": "PendingNew",
    "B": "Calculated",
    "C": "Expired",
}

SIDES: dict[str, str] = {"1": "Buy", "2": "Sell", "5": "SellShort", "6": "SellShortExempt"}

# Common delimiters used in FIX logs (SOH char, pipe, caret)
_DELIMITERS = re.compile(r"\x01|\||\^A")


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class FIXMessage:
    """Parsed representation of a single FIX message."""

    msg_type: str = ""
    msg_type_desc: str = ""
    cl_ord_id: str = ""
    orig_cl_ord_id: str = ""
    order_id: str = ""
    symbol: str = ""
    side: str = ""
    side_desc: str = ""
    price: Optional[float] = None
    qty: Optional[float] = None
    leaves_qty: Optional[float] = None
    cum_qty: Optional[float] = None
    exec_type: str = ""
    exec_type_desc: str = ""
    ord_status: str = ""
    ord_status_desc: str = ""
    timestamp: Optional[datetime] = None
    seq_num: Optional[int] = None
    sender_comp_id: str = ""
    target_comp_id: str = ""
    text: str = ""
    raw_tags: dict[str, str] = field(default_factory=dict)


@dataclass
class OrderEvent:
    """A single lifecycle event for an order."""

    event_type: str  # new / modify / cancel / fill / reject
    cl_ord_id: str
    timestamp: Optional[datetime]
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class OrderSummary:
    """Aggregated lifecycle for one order (keyed by original ClOrdID)."""

    root_cl_ord_id: str
    symbol: str
    side: str
    original_qty: Optional[float]
    events: list[OrderEvent] = field(default_factory=list)
    final_status: str = "Unknown"
    filled_qty: float = 0.0
    issues: list[str] = field(default_factory=list)


@dataclass
class FIXSession:
    """Parsed FIX session: messages + reconstructed orders."""

    messages: list[FIXMessage] = field(default_factory=list)
    orders: dict[str, OrderSummary] = field(default_factory=dict)
    sequence_gaps: list[tuple[int, int]] = field(default_factory=list)
    logon_time: Optional[datetime] = None
    logout_time: Optional[datetime] = None


@dataclass
class OrderAnalysis:
    """Result of lifecycle analysis on a FIXSession."""

    total_orders: int = 0
    filled_orders: int = 0
    cancelled_orders: int = 0
    rejected_orders: int = 0
    pending_orders: int = 0
    sequence_gaps: list[tuple[int, int]] = field(default_factory=list)
    issues: list[str] = field(default_factory=list)
    order_summaries: list[OrderSummary] = field(default_factory=list)
    avg_fill_qty: float = 0.0
    session_duration_seconds: Optional[float] = None


# ---------------------------------------------------------------------------
# FIXParser
# ---------------------------------------------------------------------------


class FIXParser:
    """
    Stateless FIX parser.  All methods are pure functions on their inputs.
    """

    # ------------------------------------------------------------------
    # Low-level tag parsing
    # ------------------------------------------------------------------

    def _split_tags(self, raw: str) -> dict[str, str]:
        """Split a raw FIX message string into a {tag: value} dict."""
        tags: dict[str, str] = {}
        for part in _DELIMITERS.split(raw):
            if "=" in part:
                tag, _, val = part.partition("=")
                if tag.strip():
                    tags[tag.strip()] = val.strip()
        return tags

    def _parse_timestamp(self, raw: str) -> Optional[datetime]:
        """Parse a FIX SendingTime (52) value: YYYYMMDD-HH:MM:SS[.sss]."""
        if not raw:
            return None
        # Try ISO-like prefix in log lines first (e.g. "2024-01-15 14:23:07")
        for fmt in (
            "%Y%m%d-%H:%M:%S.%f",
            "%Y%m%d-%H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
        ):
            try:
                return datetime.strptime(raw[:len(fmt) + 2].strip(), fmt)
            except ValueError:
                continue
        return None

    # ------------------------------------------------------------------
    # Single message parser
    # ------------------------------------------------------------------

    def parse_message(self, raw: str) -> FIXMessage:
        """
        Parse a raw FIX message string into a FIXMessage dataclass.

        Handles both SOH-delimited and pipe-delimited formats.
        """
        tags = self._split_tags(raw)
        msg = FIXMessage(raw_tags=tags)

        msg.msg_type = tags.get("35", "")
        msg.msg_type_desc = MSG_TYPES.get(msg.msg_type, f"Unknown({msg.msg_type})")

        msg.cl_ord_id = tags.get("11", "")
        msg.orig_cl_ord_id = tags.get("41", "")
        msg.order_id = tags.get("37", "")
        msg.symbol = tags.get("55", "")

        msg.side = tags.get("54", "")
        msg.side_desc = SIDES.get(msg.side, msg.side)

        msg.exec_type = tags.get("150", "")
        msg.exec_type_desc = EXEC_TYPES.get(msg.exec_type, msg.exec_type)

        msg.ord_status = tags.get("39", "")
        msg.ord_status_desc = ORD_STATUS.get(msg.ord_status, msg.ord_status)

        msg.sender_comp_id = tags.get("49", "")
        msg.target_comp_id = tags.get("56", "")
        msg.text = tags.get("58", "")

        try:
            msg.price = float(tags["44"]) if "44" in tags else None
        except ValueError:
            msg.price = None

        for tag, attr in (("38", "qty"), ("151", "leaves_qty"), ("14", "cum_qty")):
            if tag in tags:
                try:
                    setattr(msg, attr, float(tags[tag]))
                except ValueError:
                    pass

        if "34" in tags:
            try:
                msg.seq_num = int(tags["34"])
            except ValueError:
                pass

        raw_ts = tags.get("52") or tags.get("60", "")
        msg.timestamp = self._parse_timestamp(raw_ts)

        return msg

    # ------------------------------------------------------------------
    # Session log parser
    # ------------------------------------------------------------------

    def parse_session_log(self, log_lines: list[str]) -> FIXSession:
        """
        Parse a list of raw log lines into a FIXSession.

        Extracts FIX messages embedded in log lines, reconstructs order
        lifecycles, and detects sequence gaps.
        """
        session = FIXSession()
        last_seq: Optional[int] = None

        for line in log_lines:
            # Skip empty / non-FIX lines
            if not line.strip():
                continue

            # Lines may start with a timestamp prefix – extract the FIX portion
            fix_start = line.find("8=FIX")
            if fix_start == -1:
                continue
            raw_fix = line[fix_start:]

            msg = self.parse_message(raw_fix)
            session.messages.append(msg)

            # Track sequence gaps
            if msg.seq_num is not None:
                if last_seq is not None and msg.seq_num != last_seq + 1:
                    # Sequence reset (tag 36) is normal; gap otherwise
                    if msg.msg_type != "4":  # Not SequenceReset
                        session.sequence_gaps.append((last_seq + 1, msg.seq_num - 1))
                last_seq = msg.seq_num

            # Track logon/logout times
            if msg.msg_type == "A" and session.logon_time is None:
                session.logon_time = msg.timestamp
            elif msg.msg_type == "5":
                session.logout_time = msg.timestamp

            # Reconstruct order lifecycle
            self._update_order_lifecycle(session, msg)

        return session

    def _update_order_lifecycle(self, session: FIXSession, msg: FIXMessage) -> None:
        """Update session.orders based on a parsed message."""
        if msg.msg_type == "D":
            # NewOrderSingle – create order entry
            order = OrderSummary(
                root_cl_ord_id=msg.cl_ord_id,
                symbol=msg.symbol,
                side=msg.side_desc,
                original_qty=msg.qty,
            )
            order.events.append(
                OrderEvent(
                    event_type="new",
                    cl_ord_id=msg.cl_ord_id,
                    timestamp=msg.timestamp,
                    details={"symbol": msg.symbol, "qty": msg.qty, "price": msg.price},
                )
            )
            session.orders[msg.cl_ord_id] = order

        elif msg.msg_type in ("G", "F"):
            # Modify / Cancel – link to original
            root_id = msg.orig_cl_ord_id or msg.cl_ord_id
            order = session.orders.get(root_id) or OrderSummary(
                root_cl_ord_id=root_id, symbol=msg.symbol, side=msg.side_desc, original_qty=None
            )
            event_type = "modify" if msg.msg_type == "G" else "cancel_request"
            order.events.append(
                OrderEvent(
                    event_type=event_type,
                    cl_ord_id=msg.cl_ord_id,
                    timestamp=msg.timestamp,
                    details={"orig_cl_ord_id": msg.orig_cl_ord_id},
                )
            )
            session.orders[root_id] = order

        elif msg.msg_type == "8":
            # ExecutionReport
            root_id = msg.orig_cl_ord_id or msg.cl_ord_id
            order = session.orders.get(root_id) or session.orders.get(msg.cl_ord_id)
            if order is None:
                # Execution without a tracked NewOrder
                order = OrderSummary(
                    root_cl_ord_id=msg.cl_ord_id,
                    symbol=msg.symbol,
                    side=msg.side_desc,
                    original_qty=msg.qty,
                )
                session.orders[msg.cl_ord_id] = order
                order.issues.append("ExecutionReport received without matching NewOrderSingle")

            exec_type = msg.exec_type_desc or msg.exec_type
            order.events.append(
                OrderEvent(
                    event_type=f"exec_{exec_type.lower()}",
                    cl_ord_id=msg.cl_ord_id,
                    timestamp=msg.timestamp,
                    details={
                        "exec_type": exec_type,
                        "ord_status": msg.ord_status_desc,
                        "cum_qty": msg.cum_qty,
                        "leaves_qty": msg.leaves_qty,
                        "text": msg.text,
                    },
                )
            )

            # Update final status and filled qty
            if msg.ord_status:
                order.final_status = msg.ord_status_desc
            if msg.cum_qty is not None:
                order.filled_qty = msg.cum_qty

            # Detect reject anomalies
            if msg.exec_type == "8":  # Rejected
                order.issues.append(
                    f"Order rejected: {msg.text or 'No reason given'} (ClOrdID={msg.cl_ord_id})"
                )

    # ------------------------------------------------------------------
    # Analysis
    # ------------------------------------------------------------------

    def analyze_order_lifecycle(self, session: FIXSession) -> OrderAnalysis:
        """
        Analyse a parsed FIXSession and return an OrderAnalysis.

        Calculates fill rates, detects missing confirmations, RMS rejections,
        and sequence gaps.
        """
        analysis = OrderAnalysis(
            sequence_gaps=session.sequence_gaps,
        )

        if session.sequence_gaps:
            analysis.issues.append(
                f"Detected {len(session.sequence_gaps)} sequence gap(s): "
                + ", ".join(f"{a}-{b}" for a, b in session.sequence_gaps[:5])
            )

        for order in session.orders.values():
            analysis.total_orders += 1
            analysis.order_summaries.append(order)

            status = order.final_status.lower()
            if "fill" in status or status == "filled":
                analysis.filled_orders += 1
            elif "cancel" in status:
                analysis.cancelled_orders += 1
            elif "reject" in status:
                analysis.rejected_orders += 1
            else:
                analysis.pending_orders += 1

            # Check for orders with no execution report
            exec_events = [e for e in order.events if e.event_type.startswith("exec_")]
            if not exec_events:
                analysis.issues.append(
                    f"Order {order.root_cl_ord_id} ({order.symbol}) has no ExecutionReport"
                )

            analysis.issues.extend(order.issues)

        # Average fill qty
        filled_orders = [o for o in session.orders.values() if o.filled_qty > 0]
        if filled_orders:
            analysis.avg_fill_qty = sum(o.filled_qty for o in filled_orders) / len(filled_orders)

        # Session duration
        if session.logon_time and session.logout_time:
            delta = session.logout_time - session.logon_time
            analysis.session_duration_seconds = delta.total_seconds()

        return analysis

    # ------------------------------------------------------------------
    # RCA generation
    # ------------------------------------------------------------------

    def generate_rca(self, analysis: OrderAnalysis) -> str:
        """
        Generate a human-readable Root Cause Analysis summary from an
        OrderAnalysis.
        """
        lines: list[str] = []
        lines.append("# FIX Session Root Cause Analysis\n")

        lines.append("## Session Statistics")
        lines.append(f"- Total orders tracked: {analysis.total_orders}")
        lines.append(f"- Filled: {analysis.filled_orders}")
        lines.append(f"- Cancelled: {analysis.cancelled_orders}")
        lines.append(f"- Rejected: {analysis.rejected_orders}")
        lines.append(f"- Pending/Unknown: {analysis.pending_orders}")
        if analysis.session_duration_seconds is not None:
            lines.append(f"- Session duration: {analysis.session_duration_seconds:.1f}s")
        if analysis.avg_fill_qty:
            lines.append(f"- Average fill quantity: {analysis.avg_fill_qty:.2f}")
        lines.append("")

        if analysis.sequence_gaps:
            lines.append("## Sequence Gaps Detected")
            for start, end in analysis.sequence_gaps:
                lines.append(f"- SeqNums {start}–{end} missing")
            lines.append(
                "\n**Impact:** Missing messages may indicate dropped packets or "
                "session reset. The counterparty may have sent messages that were "
                "not received, leading to stale order states.\n"
            )

        if analysis.issues:
            lines.append("## Issues Found")
            for issue in analysis.issues[:20]:
                lines.append(f"- {issue}")
            lines.append("")

        if analysis.rejected_orders > 0:
            lines.append("## Rejection Analysis")
            rejections = [
                o
                for o in analysis.order_summaries
                if "reject" in o.final_status.lower() or o.issues
            ]
            for order in rejections[:5]:
                lines.append(f"- **{order.root_cl_ord_id}** ({order.symbol}): {'; '.join(order.issues)}")
            lines.append("")

        lines.append("## Recommendations")
        if analysis.sequence_gaps:
            lines.append("1. Implement automatic ResendRequest on gap detection.")
            lines.append("2. Review network infrastructure for packet loss.")
        if analysis.rejected_orders > 0:
            lines.append("3. Review RMS limits and pre-trade validation rules.")
            lines.append("4. Ensure ClOrdID uniqueness across sessions.")
        if analysis.pending_orders > 0:
            lines.append("5. Investigate orders with no ExecutionReport confirmation.")
        if not (analysis.sequence_gaps or analysis.rejected_orders or analysis.pending_orders):
            lines.append("- Session appears clean. Continue standard monitoring.")

        return "\n".join(lines)
