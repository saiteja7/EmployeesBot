import React, { useMemo, useState, useEffect } from 'react';
import './BotChat.css';

function BotChat() {
    const [WebChat, setWebChat] = useState(null);
    const [error, setError] = useState(null);

    // Dynamically import botframework-webchat
    useEffect(() => {
        const loadWebChat = async () => {
            try {
                const module = await import('botframework-webchat');
                setWebChat(module);
            } catch (err) {
                console.error('Failed to load botframework-webchat:', err);
                setError(err.message);
            }
        };
        loadWebChat();
    }, []);

    // Create Direct Line connection
    const directLine = useMemo(() => {
        if (!WebChat) return null;
        try {
            return WebChat.createDirectLine({
                secret: import.meta.env.VITE_DIRECT_LINE_SECRET || process.env.REACT_APP_DIRECT_LINE_SECRET || 'YOUR_DIRECT_LINE_SECRET_HERE'
            });
        } catch (err) {
            console.error('Failed to create DirectLine:', err);
            setError(err.message);
            return null;
        }
    }, [WebChat]);

    const styleOptions = {
        // Customize the web chat appearance
        botAvatarInitials: 'IB',
        userAvatarInitials: 'You',
        bubbleBackground: '#0078d4',
        bubbleFromUserBackground: '#e6f2ff',
        bubbleTextColor: 'white',
        bubbleFromUserTextColor: '#000',
        sendBoxBackground: '#f3f2f1',
        sendBoxTextColor: '#000',
        hideUploadButton: true,
    };

    if (error) {
        return (
            <div className="bot-chat-container">
                <div className="bot-chat-header">
                    <h2>🤖 IEBA - Intelligent Employee & Billing Analyst</h2>
                </div>
                <div className="bot-chat-window" style={{ padding: '20px', color: 'red' }}>
                    <p><strong>Error loading bot:</strong></p>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (!WebChat || !directLine) {
        return (
            <div className="bot-chat-container">
                <div className="bot-chat-header">
                    <h2>🤖 IEBA - Intelligent Employee & Billing Analyst</h2>
                </div>
                <div className="bot-chat-window" style={{ padding: '20px' }}>
                    <p>Loading bot...</p>
                </div>
            </div>
        );
    }

    const ReactWebChat = WebChat.default;

    return (
        <div className="bot-chat-container">
            <div className="bot-chat-header">
                <h2>🤖 IEBA - Intelligent Employee & Billing Analyst</h2>
                <p>Ask me about employees, billing, profit/loss analysis</p>
            </div>
            <div className="bot-chat-window">
                <ReactWebChat
                    directLine={directLine}
                    styleOptions={styleOptions}
                    userID={"user-" + Math.random().toString(36).substr(2, 9)}
                />
            </div>
        </div>
    );
}

export default BotChat;
