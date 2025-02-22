'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Toaster, toast } from 'sonner'

interface Message {
  sender: string
  content: string
  timestamp: Date
}

interface Room {
  name: string
  messages: Message[]
}

export default function Chat() {
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [rooms, setRooms] = useState<Room[]>([])
  const [currentRoom, setCurrentRoom] = useState<string>('')
  const [newRoomName, setNewRoomName] = useState('')

  const handleMessage = useCallback((message: string) => {
    console.log('Received message:', message)
    
    if (message.startsWith('ROOM_LIST:')) {
      console.log('Received room list:', message)
      const roomList = message.slice(10).split(',').filter(Boolean);
      setRooms(prevRooms => {
        const existingRooms = new Map(prevRooms.map(r => [r.name, r.messages]));
        return roomList.map((name: string) => ({
          name,
          messages: existingRooms.get(name) || []
        }));
      });
      return;
    }

    // Parse message with timestamp: "sender [HH:MM:SS]: content"
    const messageMatch = message.match(/^([^[]+)\s*\[([^\]]+)\]:\s*(.+)$/);
    console.log('Message match:', messageMatch)
    if (messageMatch) {
      const [_, sender, timeStr, content] = messageMatch;

      setRooms(prevRooms => {
        // Find the room by sender's message content if it's history
        const roomName = currentRoom || prevRooms[0]?.name;
        if (!roomName) return prevRooms;

        const updatedRooms = [...prevRooms];
        const roomIndex = updatedRooms.findIndex(r => r.name === roomName);
        
        if (roomIndex === -1) return prevRooms;

        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        const timestamp = new Date();
        timestamp.setHours(hours, minutes, seconds);

        const newMessage = {
          sender: sender.trim(),
          content,
          timestamp
        };

        updatedRooms[roomIndex] = {
          ...updatedRooms[roomIndex],
          messages: [...updatedRooms[roomIndex].messages, newMessage]
        };

        return updatedRooms;
      });
    }
  }, [currentRoom]);

  useEffect(() => {
    const websocket = new WebSocket(process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080')
    
    websocket.onopen = () => {
      toast.success('Connected to chat server', {
        description: 'You can now start chatting!'
      })
    }

    websocket.onclose = () => {
      toast.error('Disconnected from server', {
        description: 'Trying to reconnect...'
      })
    }

    websocket.onerror = () => {
      toast.error('Connection error', {
        description: 'Failed to connect to the chat server'
      })
    }

    websocket.onmessage = (event) => {
      handleMessage(event.data);
    }

    setWs(websocket)

    return () => {
      websocket.close()
    }
  }, []);

  const createRoom = () => {
    if (!newRoomName) return
    ws?.send(`CREATE_ROOM:${newRoomName}`)
    setRooms(prev => [...prev, { name: newRoomName, messages: [] }])
    setCurrentRoom(newRoomName)
    setNewRoomName('')
  }

  const joinRoom = (roomName: string) => {
    setCurrentRoom(roomName);
    // Ensure room exists in state
    setRooms(prev => {
      const roomExists = prev.some(r => r.name === roomName);
      if (!roomExists) {
        return [...prev, { name: roomName, messages: [] }];
      }
      return prev;
    });
    // Send join message after state is updated
    ws?.send(`JOIN_ROOM:${roomName}`);
  }

  const leaveRoom = () => {
    if (!currentRoom) return
    ws?.send(`LEAVE_ROOM:${currentRoom}`)
    setCurrentRoom('')
  }

  const sendMessage = () => {
    if (!message || !currentRoom || !username) return
    const messageToSend = `ROOM_MSG:${currentRoom}:${username}:${message}`
    console.log('Sending message:', messageToSend)
    ws?.send(messageToSend)
    setMessage('')
  }

  console.log('Current room state:', rooms.find(r => r.name === currentRoom)?.messages);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-4">
      <Toaster richColors closeButton position="top-center" />
      <div className="max-w-6xl mx-auto grid grid-cols-4 gap-4">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Chat Rooms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <div className="flex space-x-2">
              <Input
                placeholder="New room name"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
              />
              <Button onClick={createRoom}>Create</Button>
            </div>
            <ScrollArea className="h-[300px]">
              {rooms.map((room) => (
                <Button
                  key={room.name}
                  variant={currentRoom === room.name ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => joinRoom(room.name)}
                >
                  # {room.name}
                </Button>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{currentRoom || 'Select a room'}</CardTitle>
            {currentRoom && (
              <Button variant="destructive" onClick={leaveRoom}>
                Leave Room
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] mb-4">
              {currentRoom && rooms.find(r => r.name === currentRoom)?.messages.map((msg, i) => (
                <div
                  key={i}
                  className={`mb-4 p-3 rounded-lg ${
                    msg.sender === username
                      ? 'bg-blue-500 ml-auto mr-2 max-w-[80%]'
                      : 'bg-gray-700 ml-2 max-w-[80%]'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-sm">{msg.sender}</span>
                    <span className="text-xs opacity-50">
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="break-words">{msg.content}</div>
                </div>
              ))}
            </ScrollArea>
            <div className="flex space-x-2">
              <Input
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                disabled={!currentRoom || !username}
              />
              <Button onClick={sendMessage} disabled={!currentRoom || !username}>
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
