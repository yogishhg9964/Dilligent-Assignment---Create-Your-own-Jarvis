'use client'

import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import EmailAgent from './components/EmailAgent'

// Markdown to JSX renderer
const parseMarkdown = (text: string) => {
  // Split text into parts and parse markdown
  const parts: (string | JSX.Element)[] = []
  let lastIndex = 0

  // Pattern for **bold**, *italic*, `code`, and links
  const patterns = [
    { regex: /\*\*(.*?)\*\*/g, tag: 'strong' },
    { regex: /\*(.*?)\*/g, tag: 'em' },
    { regex: /`(.*?)`/g, tag: 'code' },
  ]

  // Process bold first (highest priority)
  let processedText = text.replace(/\*\*(.*?)\*\*/g, (match, content) => `__STRONG_START__${content}__STRONG_END__`)
  // Process italic
  processedText = processedText.replace(/\*(.*?)\*/g, (match, content) => `__EM_START__${content}__EM_END__`)
  // Process code
  processedText = processedText.replace(/`(.*?)`/g, (match, content) => `__CODE_START__${content}__CODE_END__`)
  // Process links
  processedText = processedText.replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => `__LINK_START__${text}__LINK_SEP__${url}__LINK_END__`)

  // Split and rebuild with JSX elements
  const tokens = processedText.split(/(__\w+_START__|__\w+_END__|__\w+_SEP__)/)
  let elementId = 0
  let strongOpen = false
  let emOpen = false
  let codeOpen = false
  let linkStart = null

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token === '__STRONG_START__') {
      strongOpen = true
    } else if (token === '__STRONG_END__') {
      strongOpen = false
    } else if (token === '__EM_START__') {
      emOpen = true
    } else if (token === '__EM_END__') {
      emOpen = false
    } else if (token === '__CODE_START__') {
      codeOpen = true
    } else if (token === '__CODE_END__') {
      codeOpen = false
    } else if (token === '__LINK_START__') {
      linkStart = ''
    } else if (token === '__LINK_SEP__') {
      // URL separator found
    } else if (token === '__LINK_END__') {
      // Link processing - simplified for now
    } else if (token && !token.includes('__')) {
      let element: JSX.Element | string = token
      if (strongOpen) {
        element = <strong key={elementId++} className="font-bold">{token}</strong>
      } else if (emOpen) {
        element = <em key={elementId++} className="italic">{token}</em>
      } else if (codeOpen) {
        element = <code key={elementId++} className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">{token}</code>
      }
      if (element !== token || token.trim()) {
        parts.push(element)
      }
    }
  }

  return parts.length > 0 ? parts : text
}

interface Message {
  id: string
  text: string
  isUser: boolean
  sources?: string[]
  processingSteps?: string[]
  mode?: string
  model?: string
}

interface Model {
  name: string
  description: string
  options: Record<string, any>
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string>('')
  const [selectedMode, setSelectedMode] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [availableModels, setAvailableModels] = useState<Record<string, Model>>({})
  const [processingSteps, setProcessingSteps] = useState<string[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([])
  const [knowledgeStats, setKnowledgeStats] = useState({ total_documents: 0 })
  const [currentView, setCurrentView] = useState<'chat' | 'knowledge' | 'email'>('chat')
  const [sessionDocIds, setSessionDocIds] = useState<string[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  
  // Enterprise Feature Toggles
  const [memoryMode, setMemoryMode] = useState('short-term')
  const [citationEnforcement, setCitationEnforcement] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<Message[]>([])
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sidebarFileInputRef = useRef<HTMLInputElement>(null)

  // Suggested starter questions
  const starterQuestions = [
    'Retrieve and summarize key insights from my documents',
    'What patterns exist across my knowledge base?',
    'Answer based on my uploaded documents only',
    'Provide information with source attribution',
    'Help me analyze my knowledge base'
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load conversations from localStorage
  useEffect(() => {
    const savedConversations = localStorage.getItem('conversations')
    if (savedConversations) {
      try {
        const parsedConversations = JSON.parse(savedConversations)
        setConversations(parsedConversations)
      } catch (e) {
        console.error('Error parsing saved conversations:', e)
      }
    }
  }, [])

  // Save conversations to localStorage
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('conversations', JSON.stringify(conversations))
    }
  }, [conversations])

  // Load conversation from localStorage on mount
  useEffect(() => {
    const savedConversationId = localStorage.getItem('conversationId')
    const savedMessages = localStorage.getItem('messages')
    const savedSessionDocs = localStorage.getItem('sessionDocIds')

    if (savedConversationId) {
      setConversationId(savedConversationId)
    }

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages)
        setMessages(parsedMessages)
      } catch (e) {
        console.error('Error parsing saved messages:', e)
      }
    }

    if (savedSessionDocs) {
      try {
        const parsedDocs = JSON.parse(savedSessionDocs)
        setSessionDocIds(parsedDocs)
      } catch (e) {
        console.error('Error parsing saved session docs:', e)
      }
    }
  }, [])

  // Save conversation to localStorage whenever it changes
  useEffect(() => {
    if (conversationId) {
      localStorage.setItem('conversationId', conversationId)
    }
    if (messages.length > 0) {
      localStorage.setItem('messages', JSON.stringify(messages))
    }
    if (sessionDocIds.length > 0) {
      localStorage.setItem('sessionDocIds', JSON.stringify(sessionDocIds))
    }
  }, [conversationId, messages, sessionDocIds])

  useEffect(() => {
    // Load available models on component mount
    const loadModels = async () => {
      try {
        const response = await axios.get('http://localhost:8000/models')
        setAvailableModels(response.data.available)
        setSelectedModel(response.data.current)
      } catch (error) {
        console.error('Error loading models:', error)
      }
    }
    loadModels()
    loadKnowledgeBase()
  }, [])

  const loadKnowledgeBase = async () => {
    try {
      const [statsResponse, inspectResponse] = await Promise.all([
        axios.get('http://localhost:8000/knowledge-base/stats'),
        axios.get('http://localhost:8000/knowledge-base/inspect')
      ])
      setKnowledgeStats(statsResponse.data)
      setKnowledgeBase(inspectResponse.data.metadatas || [])
    } catch (error) {
      console.error('Error loading knowledge base:', error)
    }
  }

  const handleStarterQuestion = (question: string) => {
    setInput(question)
  }

  const sendMessage = async () => {
    if (!input.trim()) return
    if (!selectedMode) {
      alert('Please select a Mode before sending a message')
      return
    }
    if (!selectedModel) {
      alert('Please select a Model before sending a message')
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      isUser: true
    }

    setMessages(prev => [...prev, userMessage])
    const currentInput = input
    setInput('')
    setIsLoading(true)
    setProcessingSteps([])
    
    // Build conversation context based on memory mode
    let conversationContext = ''
    if (memoryMode === 'short-term') {
      // Include current session messages
      conversationContext = messages.map(m => `${m.isUser ? 'User' : 'Assistant'}: ${m.text}`).join('\n')
    } else if (memoryMode === 'long-term') {
      // Include all conversation history including past sessions
      const allMessages = conversationHistory.length > 0 ? conversationHistory : messages
      conversationContext = allMessages.map(m => `${m.isUser ? 'User' : 'Assistant'}: ${m.text}`).join('\n')
    }
    // For stateless mode, conversationContext remains empty

    try {
      // Use streaming endpoint for real-time updates
      const response = await fetch('http://localhost:8000/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: currentInput,
          conversation_id: conversationId,
          mode: selectedMode,
          model: selectedModel,
          session_doc_ids: sessionDocIds,
          memory_mode: memoryMode,
          conversation_context: conversationContext,
          citation_enforcement: citationEnforcement
        })
      })

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let finalResponse = ''
      let finalConversationId = ''
      let finalSources: string[] = []
      let finalMode = ''
      let finalModel = ''
      const allProcessingSteps: string[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              break
            }

            try {
              const parsed = JSON.parse(data)

              if (parsed.type === 'status') {
                // Update processing steps in real-time
                setProcessingSteps(prev => [...prev, parsed.step])
                allProcessingSteps.push(parsed.step)
                if (parsed.conversation_id) {
                  finalConversationId = parsed.conversation_id
                }
              } else if (parsed.type === 'response') {
                finalResponse = parsed.response
                finalConversationId = parsed.conversation_id
                finalSources = parsed.sources || []
                finalMode = parsed.mode_used
                finalModel = parsed.model_used
              } else if (parsed.type === 'error') {
                throw new Error(parsed.error)
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', data)
            }
          }
        }
      }

      // Create final assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: finalResponse,
        isUser: false,
        sources: finalSources,
        processingSteps: allProcessingSteps,
        mode: finalMode,
        model: finalModel
      }

      setMessages(prev => {
        const newMessages = [...prev, assistantMessage]
        saveConversation(newMessages, finalConversationId, sessionDocIds)
        return newMessages
      })
      setConversationId(finalConversationId)
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please make sure the backend is running.',
        isUser: false
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setProcessingSteps([])
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    if (conversationId) {
      formData.append('conversation_id', conversationId)
    }

    try {
      const response = await axios.post('http://localhost:8000/upload-document', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      // Track the uploaded document ID for this session
      if (response.data.doc_id) {
        setSessionDocIds(prev => [...prev, response.data.doc_id])
      }

      const successMessage: Message = {
        id: Date.now().toString(),
        text: `Successfully uploaded ${file.name} to knowledge base! (${response.data.chunks} chunks)`,
        isUser: false
      }
      setMessages(prev => [...prev, successMessage])
      loadKnowledgeBase() // Refresh knowledge base

      // Auto-generate summary and follow-up questions
      await generateDocumentSummary(file.name)
    } catch (error: any) {
      console.error('Error uploading file:', error)
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: error.response?.data?.detail || 'Error uploading file. Please try again.',
        isUser: false
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }

  const generateDocumentSummary = async (fileName: string) => {
    try {
      const response = await fetch('http://localhost:8000/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Please provide a brief summary (2-3 sentences) of the document "${fileName}" that was just uploaded, and suggest 3-4 follow-up questions that would be helpful to ask about this document.`,
          conversation_id: conversationId,
          mode: 'context_only',
          model: selectedModel,
          session_doc_ids: sessionDocIds
        })
      })

      if (!response.body) return

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let summaryResponse = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break

            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'response') {
                summaryResponse = parsed.response
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', data)
            }
          }
        }
      }

      if (summaryResponse) {
        const summaryMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: summaryResponse,
          isUser: false
        }
        setMessages(prev => [...prev, summaryMessage])
      }
    } catch (error) {
      console.error('Error generating document summary:', error)
    }
  }

  const handleSidebarFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    if (conversationId) {
      formData.append('conversation_id', conversationId)
    }

    try {
      const response = await axios.post('http://localhost:8000/upload-document', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      // Track the uploaded document ID for this session
      if (response.data.doc_id) {
        setSessionDocIds(prev => [...prev, response.data.doc_id])
      }

      const successMessage: Message = {
        id: Date.now().toString(),
        text: `Successfully uploaded ${file.name} to knowledge base! (${response.data.chunks} chunks)`,
        isUser: false
      }
      setMessages(prev => [...prev, successMessage])
      loadKnowledgeBase() // Refresh knowledge base

      // Auto-generate summary and follow-up questions
      await generateDocumentSummary(file.name)
    } catch (error: any) {
      console.error('Error uploading file:', error)
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: error.response?.data?.detail || 'Error uploading file. Please try again.',
        isUser: false
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }

  const saveConversation = (messages: Message[], conversationId: string, sessionDocIds: string[]) => {
    if (messages.length === 0) return

    const conversation = {
      id: conversationId,
      title: messages[0]?.text.slice(0, 50) + (messages[0]?.text.length > 50 ? '...' : ''),
      messages,
      sessionDocIds,
      timestamp: new Date().toISOString()
    }

    setConversations(prev => {
      const existing = prev.findIndex(c => c.id === conversationId)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = conversation
        return updated
      } else {
        return [...prev, conversation]
      }
    })
    
    // Update long-term memory with all messages across all conversations
    if (memoryMode === 'long-term') {
      setConversationHistory(prev => {
        const combined = [...prev, ...messages]
        // Keep only unique messages by ID
        return combined.filter((msg, idx, arr) => arr.findIndex(m => m.id === msg.id) === idx)
      })
    }
  }

  const deleteDocument = async (docId: string | number) => {
    try {
      await axios.delete(`http://localhost:8000/knowledge-base/document/${docId}`)

      const successMessage: Message = {
        id: Date.now().toString(),
        text: 'Document deleted from knowledge base.',
        isUser: false
      }
      setMessages(prev => [...prev, successMessage])
      loadKnowledgeBase() // Refresh knowledge base
    } catch (error) {
      console.error('Error deleting document:', error)
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: 'Error deleting document. Please try again.',
        isUser: false
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`${sidebarCollapsed ? 'w-16' : 'w-96'} bg-slate-900 text-white flex flex-col transition-all duration-300`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-xl font-bold text-white">Your Jarvis</h1>
                <p className="text-slate-300 text-sm">Personal AI Assistant</p>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation */}
        {!sidebarCollapsed && (
          <div className="flex-1 p-4">
            <div className="space-y-4">
              {/* New Conversation */}
              <button
                onClick={() => {
                  setMessages([])
                  setConversationId('')
                  setSessionDocIds([])
                  localStorage.removeItem('conversationId')
                  localStorage.removeItem('messages')
                  localStorage.removeItem('sessionDocIds')
                  setCurrentView('chat')
                }}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${currentView === 'chat'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>New Chat</span>
              </button>

              {/* Knowledge Base */}
              <button
                onClick={() => setCurrentView('knowledge')}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${currentView === 'knowledge'
                  ? 'bg-slate-800 text-white'
                  : 'hover:bg-slate-800 text-slate-300'
                  }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <div className="flex items-center justify-between w-full">
                  <span>Knowledge Base</span>
                  <span className="text-xs bg-slate-700 px-2 py-1 rounded">
                    {knowledgeStats.total_documents}
                  </span>
                </div>
              </button>

              {/* Email Assistant */}
              <button
                onClick={() => setCurrentView('email')}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${currentView === 'email'
                  ? 'bg-slate-800 text-white'
                  : 'hover:bg-slate-800 text-slate-300'
                  }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <span>Email Agent</span>
              </button>

              {/* Chat History */}
              <div className="mt-6 flex-1 flex flex-col min-h-0">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Recent Conversations</h3>
                <div className="space-y-2 flex-1 overflow-hidden">
                  {conversations.length > 0 ? (
                    conversations.slice(-5).reverse().map((conv, index) => (
                      <button
                        key={conv.id}
                        onClick={() => {
                          setMessages(conv.messages)
                          setConversationId(conv.id)
                          setSessionDocIds(conv.sessionDocIds || [])
                          setCurrentView('chat')
                        }}
                        className="w-full text-left p-2 hover:bg-slate-800 rounded text-xs transition-colors"
                      >
                        <div className="font-medium text-white truncate">
                          {conv.title || `Chat ${conversations.length - index}`}
                        </div>
                        <div className="text-slate-400 mt-1">
                          {conv.messages?.length || 0} messages
                          {conv.sessionDocIds?.length > 0 && (
                            <span className="ml-2">📄 {conv.sessionDocIds.length}</span>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500 text-center py-4">
                      No conversations yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-700">
          {!sidebarCollapsed && (
            <div className="text-xs text-slate-400">
              <p>© 2024 Your Jarvis</p>
              <p>Enterprise AI Assistant v1.0</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white border-b px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Your Personal AI Assistant</h2>
              <p className="text-sm text-gray-600">
                Ask questions, upload documents, or get intelligent assistance
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                {selectedMode.replace('_', ' ')}
              </span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                {selectedModel}
              </span>
              {sessionDocIds.length > 0 && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium" title="Documents in this session">
                  📄 {sessionDocIds.length} session doc{sessionDocIds.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6" style={{ paddingBottom: currentView === 'chat' ? (sessionDocIds.length > 0 ? '280px' : '200px') : '24px' }}>
          {currentView === 'knowledge' ? (
            /* Knowledge Base Management View */
            <div className="max-w-6xl mx-auto">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Knowledge Base Management</h1>
                <p className="text-gray-600">Upload, manage, and organize your company documents</p>
              </div>

              {/* Upload Section */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Documents</h2>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                  <svg
                    className="w-12 h-12 text-gray-400 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-gray-600 mb-4">Drag and drop files here, or click to browse</p>
                  <button
                    onClick={() => sidebarFileInputRef.current?.click()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Choose Files
                  </button>
                  <p className="text-sm text-gray-500 mt-2">Supported formats: PDF, TXT, MD</p>
                </div>
              </div>

              {/* Documents List */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Documents ({knowledgeStats.total_documents})
                    </h2>
                    <button
                      onClick={loadKnowledgeBase}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-gray-200">
                  {knowledgeBase.length > 0 ? (
                    knowledgeBase.map((doc, index) => (
                      <div key={index} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <svg
                                className="w-5 h-5 text-blue-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900">
                                {doc.filename || `Document ${index + 1}`}
                              </h3>
                              <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                {doc.upload_date && (
                                  <span>
                                    Uploaded:{' '}
                                    {new Date(doc.upload_date).toLocaleDateString()}
                                  </span>
                                )}
                                {doc.file_size && (
                                  <span>Size: {(doc.file_size / 1024).toFixed(1)} KB</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => deleteDocument(doc.id || index)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete document"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-12 text-center">
                      <svg
                        className="w-16 h-16 text-gray-300 mx-auto mb-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
                      <p className="text-gray-600 mb-4">
                        Upload your first document to get started
                      </p>
                      <button
                        onClick={() => sidebarFileInputRef.current?.click()}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Upload Document
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : currentView === 'email' ? (
            /* Email Agent View */
            <EmailAgent />
          ) : (
            /* Chat View */
            <div>
              {messages.length === 0 ? (
                <div className="max-w-4xl mx-auto">
                  {/* Welcome Section */}
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      What's on your mind?
                    </h1>
                    <p className="text-xl text-gray-600 mb-4">
                      Intelligent Retrieval-Augmented Generation (RAG) Assistant
                    </p>
                    <div className="max-w-2xl mx-auto text-gray-600 space-y-2">
                      <p>
                        Leverage advanced language models with semantic search capabilities to extract
                        actionable insights from your knowledge base. Configure memory modes, enforce citations,
                        and choose your inference model for optimized results.
                      </p>
                     
                    </div>

                    
                  </div>

                  {/* Starter Questions */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Suggested queries:
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      {starterQuestions.map((question, index) => (
                        <button
                          key={index}
                          onClick={() => handleStarterQuestion(question)}
                          className="text-left p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all duration-200 group"
                        >
                          <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                              <svg
                                className="w-4 h-4 text-blue-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                            </div>
                            <p className="text-sm text-gray-700 group-hover:text-gray-900">
                              {question}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Features - Hidden */}
                  <div className="hidden">
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                        <svg
                          className="w-6 h-6 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Document Intelligence
                      </h3>
                      <p className="text-gray-600 text-sm">
                        Upload company documents, policies, and procedures to build a
                        comprehensive knowledge base.
                      </p>
                    </div>

                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                        <svg
                          className="w-6 h-6 text-green-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Real-time Processing
                      </h3>
                      <p className="text-gray-600 text-sm">
                        Watch live processing steps as your queries are analyzed and responses
                        are generated.
                      </p>
                    </div>

                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                        <svg
                          className="w-6 h-6 text-purple-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart Modes</h3>
                      <p className="text-gray-600 text-sm">
                        Choose between context-only, general knowledge, or mixed mode for
                        optimal responses.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto space-y-6">
                  {messages.map(message => (
                    <div
                      key={message.id}
                      className={`flex items-end gap-3 ${message.isUser ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {/* Avatar/Logo */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        message.isUser
                          ? 'bg-blue-600 text-white'
                          : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
                      }`}>
                        {message.isUser ? (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM15.657 14.243a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM11 17a1 1 0 102 0v-1a1 1 0 10-2 0v1zM5.757 15.657a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM4 10a1 1 0 01-1-1V8a1 1 0 112 0v1a1 1 0 01-1 1zM5.757 5.757a1 1 0 000-1.414L5.05 3.636a1 1 0 10-1.414 1.414l.707.707z" />
                          </svg>
                        )}
                      </div>

                      <div className={`max-w-2xl ${message.isUser ? 'order-2' : 'order-1'}`}>
                        <div
                          className={`px-4 py-3 rounded-lg ${message.isUser
                            ? 'bg-blue-600 text-white rounded-br-none'
                            : 'bg-white border border-gray-200 text-gray-900 rounded-bl-none'
                            }`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {typeof message.text === 'string' && message.text.includes('**')
                              ? parseMarkdown(message.text)
                              : message.text}
                          </p>

                          {/* Processing Steps */}
                          {message.processingSteps &&
                            message.processingSteps.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <details className="cursor-pointer">
                                  <summary className="text-xs font-medium text-gray-500 hover:text-gray-700">
                                    Processing Details (
                                    {message.processingSteps.length} steps)
                                  </summary>
                                  <ul className="mt-2 space-y-1 text-xs text-gray-600">
                                    {message.processingSteps.map((step, index) => (
                                      <li
                                        key={index}
                                        className="flex items-start"
                                      >
                                        <span className="w-1 h-1 bg-green-500 rounded-full mr-2 mt-2 flex-shrink-0" />
                                        {step}
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              </div>
                            )}

                          {/* Sources and Metadata */}
                          {(message.sources?.length ||
                            message.mode ||
                            message.model) && (
                              <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                                {message.sources &&
                                  message.sources.length > 0 && (
                                    <p className="mb-2">
                                      <span className="font-medium">
                                        Sources:
                                      </span>{' '}
                                      {message.sources.join(', ')}
                                    </p>
                                  )}
                                <div className="flex space-x-2">
                                  {message.mode && (
                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                      {message.mode.replace('_', ' ')}
                                    </span>
                                  )}
                                  {message.model && (
                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                      {message.model}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 px-4 py-3 rounded-lg max-w-lg">
                        <div className="flex items-center space-x-2 mb-3">
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          <span className="font-medium text-gray-900">
                            Processing your request...
                          </span>
                        </div>

                        {/* Live Processing Steps */}
                        <div className="text-sm text-gray-600">
                          {processingSteps.length > 0 ? (
                            <div>
                              <p className="font-medium mb-2 text-blue-600">
                                Processing Steps:
                              </p>
                              <ul className="space-y-1 max-h-32 overflow-y-auto">
                                {processingSteps.map((step, index) => (
                                  <li
                                    key={index}
                                    className="flex items-start animate-fadeIn"
                                  >
                                    <span className="w-1 h-1 bg-green-500 rounded-full mr-2 mt-2 flex-shrink-0" />
                                    <span className="text-gray-700 text-xs">
                                      {step}
                                    </span>
                                  </li>
                                ))}
                                <li className="flex items-start">
                                  <div className="w-1 h-1 bg-blue-500 rounded-full mr-2 mt-2 flex-shrink-0 animate-pulse" />
                                  <span className="text-blue-600 italic text-xs">
                                    Processing...
                                  </span>
                                </li>
                              </ul>
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <div className="w-1 h-1 bg-blue-500 rounded-full mr-2 animate-pulse" />
                              <span className="text-blue-600 text-xs">
                                Initializing...
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fixed Chat Input - Only show in chat mode */}
      {currentView === 'chat' && (
        <div className="fixed bottom-0 border-t px-6 py-4 z-50 bg-white" style={{ left: `${sidebarCollapsed ? '64px' : '384px'}`, right: 0, transition: 'left 0.3s' }}>
          <div className="max-w-4xl mx-auto">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".txt,.md,.pdf"
              className="hidden"
            />
            <input
              type="file"
              ref={sidebarFileInputRef}
              onChange={handleSidebarFileUpload}
              accept=".txt,.md,.pdf"
              className="hidden"
            />

            {/* Display uploaded files - Session Indicator */}
            {sessionDocIds.length > 0 && (
              <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-l-4 border-blue-500 animate-slideDown">
                <div className="text-xs font-semibold text-blue-900 mb-2 flex items-center">
                  <svg className="w-4 h-4 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 3.062v6.757a1 1 0 01-.940 1.069 60.513 60.513 0 01-9.5 0 1 1 0-1.069v-6.757a3.066 3.066 0 012.812-3.062zM9 13a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  📎 Session Documents Active
                </div>
                <div className="flex flex-wrap gap-2">
                  {sessionDocIds.map((docId, index) => {
                    const doc = knowledgeBase.find(d => (d.id && d.id === docId) || (d.doc_id && d.doc_id === docId)) ||
                      knowledgeBase.find((d, i) => i.toString() === docId);
                    return doc ? (
                      <div key={docId} className="flex items-center bg-white text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm border border-blue-200 hover:shadow-md transition-shadow">
                        <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        <span className="truncate">{doc.filename || `Document ${index + 1}`}</span>
                        <button
                          onClick={() => setSessionDocIds(prev => prev.filter(id => id !== docId))}
                          className="ml-2 text-blue-500 hover:text-blue-700 font-bold"
                          title="Remove from session"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div key={docId} className="flex items-center bg-white text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm border border-gray-200">
                        <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        <span className="truncate">Document {docId}</span>
                        <button
                          onClick={() => setSessionDocIds(prev => prev.filter(id => id !== docId))}
                          className="ml-2 text-gray-500 hover:text-gray-700 font-bold"
                          title="Remove from session"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Chat Input with Integrated Controls */}
            <div className="relative bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
              {/* Top Controls Bar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  {/* Upload Button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                    title="Upload document for this conversation"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>

                  {/* Citation Enforcement Toggle */}
                  <button
                    onClick={() => setCitationEnforcement(!citationEnforcement)}
                    className={`flex items-center space-x-0.5 px-2 py-1 text-xs rounded transition-colors ${
                      citationEnforcement
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    title="Enable citation enforcement - ensures all responses are grounded in retrieved sources"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-semibold">Grounding</span>
                  </button>
                      <div className="flex items-center space-x-0.5">
                      <svg
                        className="w-3.5 h-3.5 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                      </svg>
                      <select
                        value={selectedMode}
                        onChange={e => setSelectedMode(e.target.value)}
                        className="bg-transparent border-none text-xs text-gray-700 focus:outline-none cursor-pointer"
                      >
                        <option value="">Query Mode</option>
                        <option value="mixed">Hybrid (RAG + LLM)</option>
                        <option value="context_only">Document-Only (RAG)</option>
                        <option value="general_only">Generation-Only (LLM)</option>
                      </select>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Model Selector */}
                  <div className="flex items-center space-x-0.5">
                    <svg
                      className="w-3.5 h-3.5 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    <select
                      value={selectedModel}
                      onChange={e => setSelectedModel(e.target.value)}
                      className="bg-transparent border-none text-xs text-gray-700 focus:outline-none cursor-pointer"
                    >
                      <option value="">Model</option>
                      {Object.entries(availableModels).map(([key, model]) => (
                        <option key={key} value={key}>
                          {key.charAt(0).toUpperCase() + key.slice(1)}
                        </option>
                      ))}
                    </select>
                    <svg
                      className="w-2.5 h-2.5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>

                  {/* Memory Mode Selector */}
                  <div className="flex items-center space-x-0.5">
                    <svg
                      className="w-3.5 h-3.5 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                      />
                    </svg>
                    <select
                      value={memoryMode}
                      onChange={e => setMemoryMode(e.target.value)}
                      className="bg-transparent border-none text-xs text-gray-700 focus:outline-none cursor-pointer"
                      title="Select context retention strategy"
                    >
                      <option value="stateless">Stateless</option>
                      <option value="short-term">Session</option>
                      <option value="long-term">Persistent</option>
                    </select>
                    <svg
                      className="w-3 h-3 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Input Area */}
              <div className="flex items-end p-4">
                <input
                  type="text"
                  value={input}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setInput(e.target.value)
                  }
                  onKeyDown={(e: React.KeyboardEvent) =>
                    e.key === 'Enter' && sendMessage()
                  }
                  placeholder="Ask your Jarvis anything..."
                  className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-500 text-base resize-none"
                  disabled={isLoading}
                />
                <button
                  onClick={sendMessage}
                  disabled={isLoading || !input.trim()}
                  className="ml-3 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <svg
                      className="w-5 h-5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
