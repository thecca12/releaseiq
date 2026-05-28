"""
WebSocket connection manager for broadcasting real-time events.
"""

from typing import Dict, List

from fastapi import WebSocket

from app.core.logging import get_logger

logger = get_logger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections and provides broadcast utilities."""

    def __init__(self) -> None:
        # Map room_id → list of WebSocket connections
        self._rooms: Dict[str, List[WebSocket]] = {}
        # Map connection → user_id
        self._user_map: Dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket, room_id: str, user_id: str) -> None:
        await websocket.accept()
        self._rooms.setdefault(room_id, []).append(websocket)
        self._user_map[websocket] = user_id
        logger.info("ws_connected", room=room_id, user_id=user_id)

    def disconnect(self, websocket: WebSocket, room_id: str) -> None:
        room = self._rooms.get(room_id, [])
        if websocket in room:
            room.remove(websocket)
        self._user_map.pop(websocket, None)
        logger.info("ws_disconnected", room=room_id)

    async def send_personal(self, message: dict, websocket: WebSocket) -> None:
        await websocket.send_json(message)

    async def broadcast(self, message: dict, room_id: str) -> None:
        """Broadcast a JSON message to all connections in a room."""
        for connection in list(self._rooms.get(room_id, [])):
            try:
                await connection.send_json(message)
            except Exception as exc:
                logger.warning("ws_broadcast_error", room=room_id, error=str(exc))

    async def broadcast_all(self, message: dict) -> None:
        """Broadcast a message to every connected client."""
        for room_connections in list(self._rooms.values()):
            for connection in list(room_connections):
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

    @property
    def total_connections(self) -> int:
        return sum(len(conns) for conns in self._rooms.values())


# Module-level singleton
manager = ConnectionManager()
