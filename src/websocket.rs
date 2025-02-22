use futures::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio_tungstenite::{
    accept_async,
    tungstenite::Message,
};
use std::sync::Arc;
use std::net::SocketAddr;
use tokio::net::TcpStream;

use crate::channel::ChannelManager;

pub async fn handle_connection(stream: TcpStream, addr: SocketAddr, channel_manager: Arc<ChannelManager>) {
    let ws_stream = accept_async(stream).await.expect("Error during the websocket handshake");
    println!("New connection from {}", addr);
    let (mut write, mut read) = ws_stream.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    let channel_manager = channel_manager.clone();

    // Send active rooms list to new client
    let active_rooms = channel_manager.get_active_rooms().await;
    let rooms_message = format!("ROOM_LIST:{}", active_rooms.join(","));
    write.send(Message::Text(rooms_message)).await.expect("Failed to send room list");

    tokio::spawn(async move {
        while let Some(message) = rx.recv().await {
            match write.send(message).await {
                Ok(_) => {},
                Err(_) => break // Exit loop if send fails
            }
        }
    });

    let mut current_channel = String::new();

    while let Some(message) = read.next().await {
        match message {
            Ok(Message::Text(text)) => {
                if text.starts_with("CREATE_ROOM:") {
                    let room_name = &text[12..];
                    channel_manager.get_or_create_channel(room_name.to_string()).await;
                    channel_manager.add_sender_to_channel(room_name.to_string(), tx.clone()).await;
                    current_channel = room_name.to_string();
                    println!("Created room: {}", room_name);
                } else if text.starts_with("JOIN_ROOM:") {
                    let room_name = &text[10..];
                    channel_manager.get_or_create_channel(room_name.to_string()).await;
                    channel_manager.add_sender_to_channel(room_name.to_string(), tx.clone()).await;
                    current_channel = room_name.to_string();
                    println!("Joined room: {}", room_name);
                } else if text.starts_with("LEAVE_ROOM:") {
                    let room_name = &text[11..];
                    channel_manager.remove_sender_from_channel(room_name.to_string(), tx.clone()).await;
                    current_channel.clear();
                    println!("Left room: {}", room_name);
                } else if text.starts_with("ROOM_MSG:") {
                    let parts: Vec<&str> = text[9..].splitn(3, ':').collect();
                    if parts.len() == 3 {
                        let room_name = parts[0].to_string();
                        let sender_name = parts[1].to_string();
                        let message_text = parts[2].to_string();
                        channel_manager.broadcast_message(
                            room_name,
                            sender_name.clone(),
                            message_text.clone(),
                            Message::Text(format!("{}: {}", sender_name, message_text))
                        ).await;
                    }
                }
            }
            Ok(_) => {},
            Err(_) => break // Exit loop on error
        }
    }

    // Clean up when connection ends
    if !current_channel.is_empty() {
        channel_manager.remove_sender_from_channel(current_channel, tx).await;
    }
} 