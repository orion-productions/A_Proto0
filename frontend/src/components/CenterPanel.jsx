import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Loader2 } from 'lucide-react';
import useStore from '../store/useStore';
import { api } from '../api/api';

function CenterPanel() {
  const {
    currentChatId,
    messages,
    isLoading,
    selectedModel,
    micEnabled,
    speakerEnabled,
    setMessages,
    setIsLoading,
    addMessage
  } = useStore();

  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + ' ' + transcript);
      };
    }
  }, []);

  // Handle voice input
  useEffect(() => {
    if (micEnabled && recognitionRef.current) {
      recognitionRef.current.start();
    } else if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Already stopped
      }
    }
  }, [micEnabled]);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const speakText = (text) => {
    if (speakerEnabled && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !currentChatId || isLoading) return;

    const userMessage = input.trim();
    const imageData = selectedImage;
    
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      // Save user message
      const userMsg = await api.addMessage(currentChatId, 'user', userMessage);
      addMessage(userMsg);

      // Get AI response
      let assistantResponse = '';
      const chatMessages = [...messages, { role: 'user', content: userMessage }];
      
      // Create temporary assistant message with typing indicator
      const tempAssistantMsg = {
        id: 'temp',
        role: 'assistant',
        content: '⏳ Thinking...',
        isTyping: true,
        timestamp: Date.now()
      };
      addMessage(tempAssistantMsg);

      await api.chatWithLLM(
        selectedModel,
        chatMessages.map(m => ({ role: m.role, content: m.content })),
        'ollama',
        (chunk) => {
          assistantResponse += chunk;
          // Update the temporary message
          const currentMessages = useStore.getState().messages;
          setMessages(
            currentMessages.map(m => m.id === 'temp' ? { ...m, content: assistantResponse, isTyping: false } : m)
          );
        },
        (toolEvent) => {
          // Handle tool call events
          const currentMessages = useStore.getState().messages;
          const { setActiveTool, clearActiveTool, clearAllActiveTools } = useStore.getState();
          
          // Map backend tool names to frontend tool IDs
          const toolIdMap = {
            // General tools
            'get_weather': 'weather',
            'add_numbers': 'add',
            // Jira tools
            'get_jira_issue': 'jira',
            'search_jira_issues': 'jira',
            'get_jira_project': 'jira',
            'get_jira_projects': 'jira',
            'get_jira_issue_comments': 'jira',
            'get_jira_issue_transitions': 'jira',
            'get_jira_issue_worklog': 'jira',
            // Slack tools
            'get_slack_channels': 'slack',
            'get_slack_messages': 'slack',
            'get_slack_channel_info': 'slack',
            'get_slack_user': 'slack',
            'search_slack_messages': 'slack',
            'get_slack_thread_replies': 'slack',
            // GitHub tools
            'get_github_issue': 'github',
            'get_github_repo': 'github',
            'list_github_issues': 'github',
            'get_github_pull_request': 'github',
            'list_github_pull_requests': 'github',
            'get_github_issue_comments': 'github',
            'get_github_commits': 'github',
            'search_github_repos': 'github',
            // Perforce tools
            'get_perforce_changelist': 'perforce',
            'list_perforce_changelists': 'perforce',
            'get_perforce_file_info': 'perforce',
            'list_perforce_files': 'perforce',
            'get_perforce_file_content': 'perforce',
            'get_perforce_file_history': 'perforce',
            'get_perforce_client': 'perforce',
            // Confluence tools
            'get_confluence_page': 'confluence',
            'search_confluence_pages': 'confluence',
            'get_confluence_space': 'confluence',
            'list_confluence_spaces': 'confluence',
            'get_confluence_space_pages': 'confluence',
            'get_confluence_page_children': 'confluence',
            'get_confluence_page_attachments': 'confluence',
            'get_confluence_page_comments': 'confluence',
            // Gmail tools
            'get_gmail_message': 'gmail',
            'list_gmail_messages': 'gmail',
            'search_gmail_messages': 'gmail',
            'get_gmail_labels': 'gmail',
            'get_gmail_messages_by_label': 'gmail',
            'get_gmail_thread': 'gmail',
            'get_gmail_message_attachments': 'gmail',
            'get_gmail_profile': 'gmail',
            // Google Calendar tools
            'list_calendar_events': 'google-calendar',
            'get_calendar_event': 'google-calendar',
            'list_calendars': 'google-calendar',
            'get_calendar': 'google-calendar',
            'search_calendar_events': 'google-calendar',
            'get_calendar_free_busy': 'google-calendar',
            'get_calendar_upcoming_events': 'google-calendar',
            // Google Drive tools
            'list_drive_files': 'google-drive',
            'get_drive_file': 'google-drive',
            'get_drive_file_content': 'google-drive',
            'search_drive_files': 'google-drive',
            'list_drive_folder_files': 'google-drive',
            'get_drive_folder_path': 'google-drive',
            'get_drive_about': 'google-drive',
            'list_drive_shared_files': 'google-drive',
            'list_drive_recent_files': 'google-drive',
            // Discord tools
            'get_discord_channel': 'discord',
            'list_discord_channel_messages': 'discord',
            'get_discord_message': 'discord',
            'get_discord_guild': 'discord',
            'list_discord_guild_channels': 'discord',
            'get_discord_guild_member': 'discord',
            'list_discord_guild_members': 'discord',
            'get_discord_user': 'discord',
            'get_discord_bot_user': 'discord',
            'list_discord_guilds': 'discord',
            'get_discord_message_reactions': 'discord',
            'search_discord_messages': 'discord',
            // Transcripts tools
            'get_transcripts': 'transcripts',
            'get_transcript': 'transcripts',
            'search_transcripts': 'transcripts',
            'get_latest_transcript': 'transcripts',
            // Math tools
            'add_numbers': 'calculator',
            'calculator': 'calculator',
          };
          
          if (toolEvent.type === 'call') {
            const frontendToolId = toolIdMap[toolEvent.tool] || toolEvent.tool;
            
            console.log('Tool event received:', toolEvent);
            console.log('Backend tool name:', toolEvent.tool);
            console.log('Mapped to frontend ID:', frontendToolId);
            console.log('Current activeTools:', useStore.getState().activeTools);
            
            // Show tool being called
            const toolMsg = `🔧 Using ${toolEvent.tool}(${JSON.stringify(toolEvent.params)})...`;
            setMessages(
              currentMessages.map(m => m.id === 'temp' ? { ...m, content: toolMsg, isTyping: true } : m)
            );
            // Mark tool as active
            console.log('Setting active tool:', frontendToolId);
            setActiveTool(frontendToolId);
            console.log('After set, activeTools:', useStore.getState().activeTools);
          } else if (toolEvent.type === 'result') {
            const frontendToolId = toolIdMap[toolEvent.tool] || toolEvent.tool;
            
            // Show tool result received
            const resultMsg = `✅ Got result from ${toolEvent.tool}`;
            setMessages(
              currentMessages.map(m => m.id === 'temp' ? { ...m, content: resultMsg, isTyping: true } : m)
            );
            // Clear tool active status
            console.log('Clearing active tool:', frontendToolId);
            clearActiveTool(frontendToolId);
          } else if (toolEvent.type === 'final') {
            // Reset for final response
            assistantResponse = '';
            setMessages(
              currentMessages.map(m => m.id === 'temp' ? { ...m, content: '💬 Generating response...', isTyping: true } : m)
            );
            // Clear all active tools
            clearAllActiveTools();
          }
        }
      );

      // Save assistant message
      const assistantMsg = await api.addMessage(currentChatId, 'assistant', assistantResponse);
      
      // Replace temp message with real one
      const currentMessages = useStore.getState().messages;
      setMessages(
        currentMessages.map(m => m.id === 'temp' ? assistantMsg : m)
      );

      // Speak response if speaker is enabled
      speakText(assistantResponse);

    } catch (error) {
      console.error('Error sending message:', error);
      // Remove temp message on error
      const currentMessages = useStore.getState().messages;
      setMessages(currentMessages.filter(m => m.id !== 'temp'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {!currentChatId ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Welcome to AI Unseen Workspace</h2>
            <p>Create a new chat to get started</p>
          </div>
        </div>
      ) : (
        <>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={message.id || index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-white'
                  }`}
                >
                  {message.isTyping ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="animate-spin" size={16} />
                      <span className="text-gray-300 animate-pulse">{message.content}</span>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-700 p-4">
            {selectedImage && (
              <div className="mb-2 relative inline-block">
                <img src={selectedImage} alt="Selected" className="h-20 rounded" />
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-2 -right-2 bg-red-600 rounded-full w-6 h-6 flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                title="Add Image"
              >
                <ImageIcon size={20} />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                rows="1"
                className="flex-1 bg-gray-800 text-white p-3 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default CenterPanel;

