"""
WebSocket handler for streaming AI chat responses.

Mount this at /ws/chat/{client_id} via the FastAPI app.

Protocol
--------
Client  →  Server:  JSON  {"message": "...", "session_id": "...", "context": [...]}
Server  →  Client:  JSON  {"type": "typing" | "token" | "done" | "error",
                            "content": "...",
                            "session_id": "..."}
"""

from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

from app.core.logging import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Message helpers
# ---------------------------------------------------------------------------


def _make_msg(msg_type: str, content: str = "", session_id: str = "", **kwargs: Any) -> str:
    return json.dumps({"type": msg_type, "content": content, "session_id": session_id, **kwargs})


def _parse_client_msg(raw: str) -> dict[str, Any]:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"message": raw, "session_id": "", "context": []}


# ---------------------------------------------------------------------------
# Connection manager
# ---------------------------------------------------------------------------


class ConnectionManager:
    """Track active WebSocket connections."""

    def __init__(self) -> None:
        self._connections: dict[str, WebSocket] = {}

    async def connect(self, client_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections[client_id] = ws
        logger.info("ws_connected", client_id=client_id, total=len(self._connections))

    def disconnect(self, client_id: str) -> None:
        self._connections.pop(client_id, None)
        logger.info("ws_disconnected", client_id=client_id, total=len(self._connections))

    async def send(self, client_id: str, payload: str) -> None:
        ws = self._connections.get(client_id)
        if ws:
            try:
                await ws.send_text(payload)
            except Exception as exc:
                logger.warning("ws_send_failed", client_id=client_id, error=str(exc))
                self.disconnect(client_id)

    @property
    def active_count(self) -> int:
        return len(self._connections)


manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Main WebSocket handler
# ---------------------------------------------------------------------------


async def chat_websocket_handler(websocket: WebSocket, client_id: str) -> None:
    """
    Handle a streaming chat WebSocket connection.

    Receives messages from the client, streams AI-generated tokens back
    in real time, and sends a final "done" event when complete.
    """
    await manager.connect(client_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            data = _parse_client_msg(raw)

            user_message: str = data.get("message", "").strip()
            session_id: str = data.get("session_id") or str(uuid.uuid4())
            context: list[dict] = data.get("context", [])

            if not user_message:
                await websocket.send_text(
                    _make_msg("error", content="Empty message received.", session_id=session_id)
                )
                continue

            logger.info(
                "ws_message_received",
                client_id=client_id,
                session_id=session_id,
                length=len(user_message),
            )

            # Send typing indicator
            await websocket.send_text(
                _make_msg("typing", content="", session_id=session_id)
            )

            # Stream AI response tokens
            full_response = []
            try:
                from app.services.ai_service import ai_service

                async for token in ai_service.stream_response(user_message, context):
                    if token:
                        full_response.append(token)
                        await websocket.send_text(
                            _make_msg("token", content=token, session_id=session_id)
                        )

            except Exception as exc:
                logger.error("ws_ai_error", client_id=client_id, error=str(exc))
                await websocket.send_text(
                    _make_msg(
                        "error",
                        content="An error occurred while generating the response.",
                        session_id=session_id,
                    )
                )
                continue

            # Send completion event
            await websocket.send_text(
                _make_msg(
                    "done",
                    content="".join(full_response),
                    session_id=session_id,
                )
            )

    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as exc:
        logger.error("ws_unexpected_error", client_id=client_id, error=str(exc))
        manager.disconnect(client_id)
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
