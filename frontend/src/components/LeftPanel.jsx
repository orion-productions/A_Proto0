import React, { useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Plus, MessageSquare, Trash2, Edit2, Check, X } from 'lucide-react';
import useStore from '../store/useStore';
import { api } from '../api/api';

function LeftPanel() {
  const {
    chats,
    currentChatId,
    scratchpadContent,
    setChats,
    setCurrentChatId,
    setScratchpadContent,
    setMessages
  } = useStore();

  const [editingChatId, setEditingChatId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleNewChat = async () => {
    try {
      const newChat = await api.createChat('New Chat');
      setChats([newChat, ...chats]);
      setCurrentChatId(newChat.id);
      setMessages([]);
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  const handleSelectChat = async (chatId) => {
    try {
      setCurrentChatId(chatId);
      const messages = await api.getMessages(chatId);
      setMessages(messages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleDeleteChat = async (chatId, e) => {
    e.stopPropagation();
    try {
      await api.deleteChat(chatId);
      setChats(chats.filter(c => c.id !== chatId));
      if (currentChatId === chatId) {
        setCurrentChatId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const handleStartEdit = (chat, e) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditingTitle(chat.title);
  };

  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setEditingChatId(null);
    setEditingTitle('');
  };

  const handleSaveEdit = async (chatId, e) => {
    e.stopPropagation();
    if (!editingTitle.trim()) return;
    
    try {
      await api.updateChat(chatId, editingTitle.trim());
      setChats(chats.map(c => 
        c.id === chatId ? { ...c, title: editingTitle.trim() } : c
      ));
      setEditingChatId(null);
      setEditingTitle('');
    } catch (error) {
      console.error('Error updating chat:', error);
    }
  };

  const handleKeyPress = (chatId, e) => {
    if (e.key === 'Enter') {
      handleSaveEdit(chatId, e);
    } else if (e.key === 'Escape') {
      handleCancelEdit(e);
    }
  };

  return (
    <div className="h-full bg-gray-800">
      <PanelGroup direction="vertical">
        <Panel defaultSize={70} minSize={30}>
          <div className="h-full flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
              >
                <Plus size={20} />
                New Chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {chats.length === 0 ? (
                <div className="p-4 text-gray-500 text-center">
                  No chats yet. Create one to get started!
                </div>
              ) : (
                <div className="p-2">
                  {chats.map(chat => (
                    <div
                      key={chat.id}
                      onClick={() => editingChatId !== chat.id && handleSelectChat(chat.id)}
                      className={`flex items-center gap-2 p-3 mb-2 rounded-lg cursor-pointer transition-colors group ${
                        currentChatId === chat.id
                          ? 'bg-blue-600'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      <MessageSquare size={18} />
                      
                      {editingChatId === chat.id ? (
                        <>
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => handleKeyPress(chat.id, e)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 bg-gray-900 text-white px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                          <button
                            onClick={(e) => handleSaveEdit(chat.id, e)}
                            className="p-1 hover:bg-green-600 rounded transition-all"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 hover:bg-red-600 rounded transition-all"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 truncate">{chat.title}</span>
                          <button
                            onClick={(e) => handleStartEdit(chat, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-600 rounded transition-all"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteChat(chat.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-600 rounded transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="h-1 bg-gray-700 hover:bg-blue-500 transition-colors" />

        <Panel defaultSize={30} minSize={15}>
          <div className="h-full flex flex-col">
            <div className="p-2 bg-gray-750 font-semibold text-sm border-t border-gray-700">Scratchpad</div>
            <textarea
              value={scratchpadContent}
              onChange={(e) => setScratchpadContent(e.target.value)}
              placeholder="Write notes, paste text..."
              className="flex-1 bg-gray-900 text-white p-3 resize-none focus:outline-none border-none"
            />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default LeftPanel;

