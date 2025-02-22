use tokio::sync::{mpsc::UnboundedSender, Mutex};
use tokio_tungstenite::tungstenite::Message;
use std::sync::Arc;
use std::collections::HashMap;

pub type Sender = UnboundedSender<Message>;

#[derive(Clone)]
pub struct ChatMessage {
    sender: String,
    content: String,
    timestamp: chrono::DateTime<chrono::Utc>,
}

pub struct Channel {
    senders: Vec<Sender>,
    messages: Vec<ChatMessage>,
}

impl Channel {
    fn new() -> Self {
        Channel {
            senders: Vec::new(),
            messages: Vec::new(),
        }
    }

    pub fn format_message(&self, msg: &ChatMessage) -> String {
        format!("{} [{}]: {}", 
            msg.sender,
            msg.timestamp.format("%H:%M:%S"),
            msg.content
        )
    }
}

pub struct ChannelManager {
    channels: Arc<Mutex<HashMap<String, Channel>>>
}

impl ChannelManager {
    pub fn new() -> Self {
        ChannelManager {
            channels: Arc::new(Mutex::new(HashMap::new()))
        }
    }

    pub async fn get_or_create_channel(&self, channel_name: String) {
        let mut channels = self.channels.lock().await;
        if !channels.contains_key(&channel_name) {
            channels.insert(channel_name.clone(), Channel::new());
        }
    }

    pub async fn add_sender_to_channel(&self, channel_name: String, sender: Sender) {
        let mut channels = self.channels.lock().await;
        if let Some(channel) = channels.get_mut(&channel_name) {
            channel.senders.push(sender.clone());
            
            // Send message history to new user
            for msg in &channel.messages {
                let history_message = channel.format_message(msg);
                sender.send(Message::Text(history_message))
                    .expect("Failed to send message history");
            }
        }
    }

    pub async fn remove_sender_from_channel(&self, channel_name: String, sender: Sender) {
        let mut channels = self.channels.lock().await;
        if let Some(channel) = channels.get_mut(&channel_name) {
            channel.senders.retain(|s| s as *const _ != &sender as *const _);
        }
    }

    pub async fn broadcast_message(&self, channel_name: String, sender_name: String, content: String, message: Message) {
        let mut channels = self.channels.lock().await;
        if let Some(channel) = channels.get_mut(&channel_name) {
            // Store the message
            channel.messages.push(ChatMessage {
                sender: sender_name,
                content,
                timestamp: chrono::Utc::now(),
            });

            // Broadcast to all senders
            channel.senders.retain(|sender| {
                match sender.send(message.clone()) {
                    Ok(_) => true,
                    Err(_) => false
                }
            });
        }
    }

    pub async fn get_active_rooms(&self) -> Vec<String> {
        let channels = self.channels.lock().await;
        channels.keys().cloned().collect()
    }
} 