'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Toaster, toast } from 'sonner'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

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

    if (message.startsWith('MSG:')) {
      const [_, roomName, sender, content] = message.split(':');
      
      setRooms(prevRooms => {
        const updatedRooms = [...prevRooms];
        const roomIndex = updatedRooms.findIndex(r => r.name === roomName);
        
        if (roomIndex === -1) return prevRooms;

        const newMessage = {
          sender: sender.trim(),
          content,
          timestamp: new Date()
        };

        updatedRooms[roomIndex] = {
          ...updatedRooms[roomIndex],
          messages: [...updatedRooms[roomIndex].messages, newMessage]
        };

        return updatedRooms;
      });
      return;
    }

    // Handle history messages
    const historyMatch = message.match(/^([^[]+)\s*\[([^\]]+)\]:\s*(.+)$/);
    if (historyMatch && currentRoom) {
      const [_, sender, timeStr, content] = historyMatch;
      
      setRooms(prevRooms => {
        const updatedRooms = [...prevRooms];
        const roomIndex = updatedRooms.findIndex(r => r.name === currentRoom);
        
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
    // First clear any existing messages for this room
    setRooms(prev => prev.map(room => 
      room.name === roomName
        ? { ...room, messages: [] }
        : room
    ));
    
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
    // Clear messages when leaving room
    setRooms(prev => prev.map(room => 
      room.name === currentRoom 
        ? { ...room, messages: [] }
        : room
    ));
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-2 sm:p-4 md:p-6">
      <Toaster richColors closeButton position="top-center" />
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-6">
        {/* Sidebar for desktop */}
        <Card className={`
          bg-gray-800/50 border-gray-700
          hidden md:block
        `}>
          <CardHeader className="space-y-1">
            <CardTitle className="text-gray-100 text-xl">Chat Rooms</CardTitle>
            <p className="text-sm text-gray-400">Join or create a room to start chatting</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-gray-700 border-gray-600 text-gray-100 placeholder:text-gray-400"
            />
            <div className="flex space-x-2">
              <Input
                placeholder="New room name"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="bg-gray-700 border-gray-600 text-gray-100 placeholder:text-gray-400"
              />
              <Button 
                onClick={createRoom}
                className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
              >
                Create
              </Button>
            </div>
            <ScrollArea className="h-[calc(100vh-250px)]">
              <div className="space-y-2">
                {rooms.map((room) => (
                  <Button
                    key={room.name}
                    variant={currentRoom === room.name ? "default" : "ghost"}
                    className={`w-full justify-start transition-all ${
                      currentRoom === room.name 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'text-gray-300 hover:text-white hover:bg-gray-700'
                    }`}
                    onClick={() => joinRoom(room.name)}
                  >
                    # {room.name}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className={`
          bg-gray-800/50 border-gray-700
          col-span-1 md:col-span-3
        `}>
          <CardHeader className="flex flex-row items-center justify-between border-b border-gray-700 p-4">
            <div className="flex items-center space-x-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Menu className="md:hidden h-5 w-5 text-white cursor-pointer" />
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] p-0 bg-gray-800/95 border-gray-700">
                  <div className="h-full">
                    <CardHeader className="space-y-1">
                      <CardTitle className="text-gray-100 text-xl">Chat Rooms</CardTitle>
                      <p className="text-sm text-gray-400">Join or create a room to start chatting</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Input
                        placeholder="Your username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="bg-gray-700 border-gray-600 text-gray-100 placeholder:text-gray-400"
                      />
                      <div className="flex space-x-2">
                        <Input
                          placeholder="New room name"
                          value={newRoomName}
                          onChange={(e) => setNewRoomName(e.target.value)}
                          className="bg-gray-700 border-gray-600 text-gray-100 placeholder:text-gray-400"
                        />
                        <Button 
                          onClick={createRoom}
                          className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                        >
                          Create
                        </Button>
                      </div>
                      <ScrollArea className="h-[calc(100vh-250px)]">
                        <div className="space-y-2">
                          {rooms.map((room) => (
                            <Button
                              key={room.name}
                              variant={currentRoom === room.name ? "default" : "ghost"}
                              className={`w-full justify-start transition-all ${
                                currentRoom === room.name 
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
                              }`}
                              onClick={() => joinRoom(room.name)}
                            >
                              # {room.name}
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </div>
                </SheetContent>
              </Sheet>
              <CardTitle className="text-gray-100">
                {currentRoom ? `#${currentRoom}` : 'Select a room'}
              </CardTitle>
            </div>
            {currentRoom && (
              <Button 
                variant="destructive" 
                onClick={leaveRoom}
                className="bg-red-600 hover:bg-red-700"
              >
                Leave Room
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0 h-[calc(100vh-180px)] flex flex-col">
            <ScrollArea className="flex-1">
              <div className="flex flex-col p-4 space-y-4">
                {currentRoom && rooms.find(r => r.name === currentRoom)?.messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${
                      msg.sender === username ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`p-3 rounded-lg max-w-[85%] sm:max-w-[75%] ${
                        msg.sender === username
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-100'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between sm:space-x-4 mb-1">
                        <span className="font-medium text-sm">{msg.sender}</span>
                        <span className="text-xs opacity-75">
                          {msg.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="break-words text-sm">{msg.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="p-4 border-t border-gray-700 mt-auto">
              <div className="flex space-x-2">
                <Input
                  placeholder={
                    !username 
                      ? "Set your username first..." 
                      : !currentRoom 
                      ? "Join a room to start chatting..." 
                      : "Type your message..."
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  disabled={!currentRoom || !username}
                  className="bg-gray-700 border-gray-600 text-gray-100 placeholder:text-gray-400"
                />
                <Button 
                  onClick={sendMessage} 
                  disabled={!currentRoom || !username}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700"
                >
                  Send
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
