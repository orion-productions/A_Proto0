import React, { useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Plus, MessageSquare, Trash2, Edit2, Check, X } from 'lucide-react';
import useStore from '../store/useStore';
import { api } from '../api/api';
import { useTranslation } from '../utils/i18n';

function LeftPanel() {
  const {
    chats,
    currentChatId,
    scratchpadContent,
    leftPanelSizes,
    selectedLanguage,
    setChats,
    setCurrentChatId,
    setScratchpadContent,
    setMessages,
    setLeftPanelSizes,
    loadScratchpadContent,
    recoverScratchpadFromBackup
  } = useStore();
  
  const t = useTranslation(selectedLanguage);

  // Load scratchpad content on mount and sync with store
  useEffect(() => {
    loadScratchpadContent();
  }, [loadScratchpadContent]);

  // Sync local state with store state
  useEffect(() => {
    setLocalScratchpadContent(scratchpadContent);
  }, [scratchpadContent]);

  // Restore chat order from localStorage
  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem('chatOrder');
      if (savedOrder && chats.length > 0) {
        const orderArray = JSON.parse(savedOrder);
        // Sort chats based on saved order
        const orderedChats = [...chats].sort((a, b) => {
          const indexA = orderArray.indexOf(a.id);
          const indexB = orderArray.indexOf(b.id);
          // Put items not in saved order at the end
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
        // Only update if order changed
        if (JSON.stringify(orderedChats.map(c => c.id)) !== JSON.stringify(chats.map(c => c.id))) {
          setChats(orderedChats);
        }
      }
    } catch (error) {
      console.error('Error restoring chat order:', error);
    }
  }, [chats.length]); // Only run when chat count changes

  const [editingChatId, setEditingChatId] = useState(null);
  const [localScratchpadContent, setLocalScratchpadContent] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  const [draggedChatId, setDraggedChatId] = useState(null);
  const [dragOverChatId, setDragOverChatId] = useState(null);

  const handleNewChat = async () => {
    try {
      const newChat = await api.createChat(t('new.chat'));
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

  // Drag and drop handlers
  const handleDragStart = (chatId, e) => {
    setDraggedChatId(chatId);
    e.dataTransfer.effectAllowed = 'move';
    // Add a semi-transparent effect
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedChatId(null);
    setDragOverChatId(null);
  };

  const handleDragOver = (chatId, e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedChatId && draggedChatId !== chatId) {
      setDragOverChatId(chatId);
    }
  };

  const handleDragLeave = () => {
    setDragOverChatId(null);
  };

  const handleDrop = (targetChatId, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedChatId || draggedChatId === targetChatId) {
      setDragOverChatId(null);
      return;
    }

    // Find indices
    const draggedIndex = chats.findIndex(c => c.id === draggedChatId);
    const targetIndex = chats.findIndex(c => c.id === targetChatId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Create new array with reordered chats
    const newChats = [...chats];
    const [draggedChat] = newChats.splice(draggedIndex, 1);
    newChats.splice(targetIndex, 0, draggedChat);

    // Update state
    setChats(newChats);
    setDragOverChatId(null);
    
    // Persist the order to localStorage
    try {
      const chatOrder = newChats.map(c => c.id);
      localStorage.setItem('chatOrder', JSON.stringify(chatOrder));
    } catch (error) {
      console.error('Error saving chat order:', error);
    }
  };

  return (
    <div className="h-full bg-gray-800">
      <PanelGroup direction="vertical" onLayout={setLeftPanelSizes}>
        <Panel defaultSize={leftPanelSizes[0]} minSize={30}>
          <div className="h-full flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
              >
                <Plus size={20} />
                {t('new.chat')}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {chats.length === 0 ? (
                <div className="p-4 text-gray-500 text-center">
                  {t('no.chat.selected')}
                </div>
              ) : (
                <div className="p-2">
                  {chats.map(chat => (
                    <div
                      key={chat.id}
                      draggable={editingChatId !== chat.id}
                      onDragStart={(e) => handleDragStart(chat.id, e)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(chat.id, e)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(chat.id, e)}
                      onClick={() => editingChatId !== chat.id && handleSelectChat(chat.id)}
                      className={`flex items-center gap-2 p-3 mb-2 rounded-lg ${editingChatId === chat.id ? 'cursor-default' : 'cursor-move'} transition-all group ${
                        currentChatId === chat.id
                          ? 'bg-blue-600'
                          : 'bg-gray-700 hover:bg-gray-600'
                      } ${
                        dragOverChatId === chat.id
                          ? 'border-2 border-blue-400 shadow-lg'
                          : 'border-2 border-transparent'
                      } ${
                        draggedChatId === chat.id
                          ? 'opacity-50'
                          : 'opacity-100'
                      }`}
                      title={chat.title}
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

        <Panel defaultSize={leftPanelSizes[1]} minSize={15}>
          <div className="h-full flex flex-col">
            <div className="p-2 bg-gray-750 font-semibold text-sm border-t border-gray-700 flex justify-between items-center">
              <span>{t('scratchpad')}</span>
              {(!localScratchpadContent || localScratchpadContent.trim() === '') && (
                <button
                  onClick={async () => {
                    try {
                      // First try to reload from file
                      await loadScratchpadContent();
                      // If still empty, try backup recovery
                      if (!scratchpadContent || scratchpadContent.trim() === '') {
                        const recovered = recoverScratchpadFromBackup();
                        if (recovered) {
                          alert('✅ Scratchpad content recovered from backup!');
                        } else {
                          alert('❌ No content found in file or backup.');
                        }
                      } else {
                        alert('✅ Scratchpad content reloaded from file!');
                      }
                    } catch (error) {
                      console.error('Recovery failed:', error);
                      alert('❌ Recovery failed. Check console for details.');
                    }
                  }}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-colors"
                  title="Recover scratchpad content from backup"
                >
                  🔄 Recover
                </button>
              )}
            </div>
            <textarea
              value={localScratchpadContent}
              onChange={(e) => {
                const newContent = e.target.value;
                setLocalScratchpadContent(newContent);
                // Debounce the save operation
                clearTimeout(window.scratchpadSaveTimeout);
                window.scratchpadSaveTimeout = setTimeout(() => {
                  setScratchpadContent(newContent);
                }, 500); // Save after 500ms of no typing
              }}
              placeholder={t('scratchpad.placeholder')}
              className="flex-1 bg-gray-900 text-white p-3 resize-none focus:outline-none border-none"
            />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default LeftPanel;

