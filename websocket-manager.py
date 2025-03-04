# app/websocket.py
from fastapi import WebSocket
from typing import Dict, List, Any
import json

class ConnectionManager:
    """Manager for WebSocket connections"""
    
    def __init__(self):
        # Store connections by user ID
        self.active_connections: Dict[int, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: int):
        """Connect a new WebSocket for a user"""
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        
        self.active_connections[user_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, user_id: int):
        """Disconnect a WebSocket"""
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            
            # Clean up if no more connections for this user
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
    
    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket):
        """Send a message to a specific WebSocket"""
        await websocket.send_text(json.dumps(message))
    
    async def broadcast_to_user(self, user_id: int, message: Dict[str, Any]):
        """Broadcast a message to all connections for a specific user"""
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_text(json.dumps(message))
    
    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast a message to all connections"""
        for user_connections in self.active_connections.values():
            for connection in user_connections:
                await connection.send_text(json.dumps(message))
