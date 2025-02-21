use tokio::sync::{mpsc::UnboundedSender, Mutex};
use tokio_tungstenite::tungstenite::Message;
use std::sync::Arc;
use std::collections::HashMap;

pub type Sender = UnboundedSender<Message>;

pub struct ChannelManager {
    channels: Arc<Mutex<HashMap<String, Vec<Sender>>>>
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
            channels.insert(channel_name.clone(), Vec::new());
        }
    }

    pub async fn add_sender_to_channel(&self, channel_name: String, sender: Sender) {
        let mut channels = self.channels.lock().await;
        if let Some(senders) = channels.get_mut(&channel_name) {
            senders.push(sender);
        }
    }

    pub async fn remove_sender_from_channel(&self, channel_name: String, sender: Sender) {
        let mut channels = self.channels.lock().await;
        if let Some(senders) = channels.get_mut(&channel_name) {
            senders.retain(|s| s as *const _ != &sender as *const _);
        }
    }

    pub async fn broadcast_message(&self, channel_name: String, message: Message) {
        let mut channels = self.channels.lock().await;
        if let Some(senders) = channels.get_mut(&channel_name) {
            for sender in senders.iter() {
                sender.send(message.clone()).expect("Failed to send message to channel");
            }
        }
    }
} 