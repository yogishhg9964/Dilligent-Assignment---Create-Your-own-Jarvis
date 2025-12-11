'use client'

import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'

interface EmailDraft {
  id: string
  to: string
  subject: string
  body: string
  cc?: string
  bcc?: string
  status: string
}

interface EmailTask {
  id: string
  description: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result?: string
  error?: string
  timestamp: string
}

export default function EmailAgent() {
  const [taskInput, setTaskInput] = useState('')
  const [emailTasks, setEmailTasks] = useState<EmailTask[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [emailDrafts, setEmailDrafts] = useState<EmailDraft[]>([])
  const [gmailConfigured, setGmailConfigured] = useState(false)
  const [processingSteps, setProcessingSteps] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkGmailConfiguration()
    loadEmailDrafts()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [emailTasks, processingSteps])

  const checkGmailConfiguration = async () => {
    try {
      const response = await axios.get('http://localhost:8000/personal-assistant/email/settings')
      setGmailConfigured(response.data.configured)
    } catch (error) {
      console.error('Error checking Gmail configuration:', error)
      setGmailConfigured(false)
    }
  }

  const loadEmailDrafts = async () => {
    try {
      const response = await axios.get('http://localhost:8000/personal-assistant/email/drafts')
      setEmailDrafts(response.data.drafts || [])
    } catch (error) {
      console.error('Error loading email drafts:', error)
    }
  }

  const processEmailTask = async (taskDescription: string) => {
    const taskId = `task_${Date.now()}`
    
    // Add new task
    const newTask: EmailTask = {
      id: taskId,
      description: taskDescription,
      status: 'pending',
      timestamp: new Date().toISOString()
    }
    
    setEmailTasks(prev => [...prev, newTask])
    setIsProcessing(true)
    setProcessingSteps([])

    try {
      // Step 1: Parse the task
      setProcessingSteps(prev => [...prev, '🔍 Analyzing your request...'])
      
      // Call backend to interpret the task and generate email
      const response = await axios.post('http://localhost:8000/personal-assistant/email/agent/process-task', {
        task_description: taskDescription
      })

      // Step 2: Show what the agent understood
      setProcessingSteps(prev => [...prev, `✅ Understood: ${response.data.interpretation}`])

      if (response.data.action === 'draft') {
        // Step 3: Create draft for user review
        setProcessingSteps(prev => [...prev, '📝 Creating email draft for your review...'])
        
        const draftResponse = await axios.post('http://localhost:8000/personal-assistant/email/draft', {
          to: response.data.email_data.to,
          subject: response.data.email_data.subject,
          body: response.data.email_data.body,
          cc: response.data.email_data.cc,
          bcc: response.data.email_data.bcc
        })

        setProcessingSteps(prev => [...prev, `📧 Draft created: ${draftResponse.data.draft_id}`])
        setProcessingSteps(prev => [...prev, '✅ Ready for your review and approval!'])

        // Update task status
        setEmailTasks(prev => prev.map(t => 
          t.id === taskId 
            ? { 
                ...t, 
                status: 'completed',
                result: `Draft created: Email to ${response.data.email_data.to} about "${response.data.email_data.subject}"`
              }
            : t
        ))

        loadEmailDrafts()
      } else if (response.data.action === 'send') {
        // Step 3: Send email directly
        setProcessingSteps(prev => [...prev, '🚀 Sending email directly...'])
        
        const sendResponse = await axios.post('http://localhost:8000/personal-assistant/email/send', {
          to: response.data.email_data.to,
          subject: response.data.email_data.subject,
          body: response.data.email_data.body,
          cc: response.data.email_data.cc,
          bcc: response.data.email_data.bcc
        })

        setProcessingSteps(prev => [...prev, `✅ Email sent successfully to ${response.data.email_data.to}!`])

        setEmailTasks(prev => prev.map(t => 
          t.id === taskId 
            ? { 
                ...t, 
                status: 'completed',
                result: `Email sent to ${response.data.email_data.to}`
              }
            : t
        ))
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error occurred'
      
      setProcessingSteps(prev => [...prev, `❌ Error: ${errorMessage}`])
      
      setEmailTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { 
              ...t, 
              status: 'failed',
              error: errorMessage
            }
          : t
      ))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSendTask = async () => {
    if (!taskInput.trim()) return
    if (!gmailConfigured) {
      alert('⚠️ Gmail is not configured. Please set up Gmail integration first.')
      return
    }

    const task = taskInput
    setTaskInput('')
    await processEmailTask(task)
  }

  const sendDraft = async (draftId: string) => {
    try {
      await axios.post(`http://localhost:8000/personal-assistant/email/draft/${draftId}/send`)
      alert('✅ Draft sent successfully!')
      loadEmailDrafts()
    } catch (error: any) {
      alert(`❌ Error: ${error.response?.data?.detail || error.message}`)
    }
  }

  const deleteDraft = async (draftId: string) => {
    try {
      await axios.delete(`http://localhost:8000/personal-assistant/email/draft/${draftId}`)
      loadEmailDrafts()
    } catch (error: any) {
      alert(`❌ Error: ${error.response?.data?.detail || error.message}`)
    }
  }

  const exampleTasks = [
    "Send an email to john@example.com confirming our meeting tomorrow at 2 PM",
    "Draft an email to the team about the project deadline extension",
    "Send a thank you email to sarah@company.com for the presentation",
    "Email alex@client.com about the proposal and schedule a follow-up call"
  ]

  if (!gmailConfigured) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Email Agent</h1>
          <p className="text-gray-600">AI-powered email assistant that understands natural language</p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <svg className="w-16 h-16 text-yellow-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-semibold text-yellow-900 mb-2">Gmail Not Configured</h3>
          <p className="text-yellow-700 mb-6 text-lg">
            To use the Email Agent, please configure your Gmail credentials.
          </p>
          <div className="space-y-3">
            <p className="text-gray-700 font-medium">Follow these steps:</p>
            <ol className="text-gray-700 space-y-2 inline-block text-left">
              <li>1. Go to Google Cloud Console</li>
              <li>2. Enable Gmail API</li>
              <li>3. Download OAuth credentials</li>
              <li>4. Save as credentials.json in backend/</li>
            </ol>
            <p className="text-sm text-gray-600 mt-4">See backend/GMAIL_SETUP.md for detailed instructions</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Email Agent</h1>
        <p className="text-gray-600">Tell the AI what emails you need to send, and it will handle them for you</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Task Input - Left Side */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Input */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                What would you like to do?
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="relative">
                <textarea
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      handleSendTask()
                    }
                  }}
                  placeholder="Example: Send an email to john@example.com confirming our 2 PM meeting tomorrow"
                  rows={4}
                  disabled={isProcessing}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none disabled:bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-2">Tip: Be specific about who to send to, what the email is about, and what you want to say</p>
              </div>

              <button
                onClick={handleSendTask}
                disabled={isProcessing || !taskInput.trim()}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
              >
                {isProcessing ? (
                  <>
                    <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send Task
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Processing Steps */}
          {(isProcessing || processingSteps.length > 0) && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Processing Steps
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {processingSteps.map((step, index) => (
                  <div key={index} className="flex items-start text-sm animate-fadeIn">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-1.5 flex-shrink-0" />
                    <span className="text-gray-700">{step}</span>
                  </div>
                ))}
                {isProcessing && (
                  <div className="flex items-start text-sm">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-1.5 flex-shrink-0 animate-pulse" />
                    <span className="text-blue-600 italic">Processing...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Email Tasks History */}
          {emailTasks.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Task History</h3>
              </div>
              <div className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                {emailTasks.map((task) => (
                  <div key={task.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-gray-900 font-medium text-sm">{task.description}</p>
                      <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                        task.status === 'completed' ? 'bg-green-100 text-green-800' :
                        task.status === 'failed' ? 'bg-red-100 text-red-800' :
                        task.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {task.status === 'completed' ? '✅ Completed' :
                         task.status === 'failed' ? '❌ Failed' :
                         task.status === 'processing' ? '⏳ Processing' :
                         '⏸️ Pending'}
                      </span>
                    </div>
                    {task.result && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded">{task.result}</p>}
                    {task.error && <p className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded">{task.error}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Drafts and Examples */}
        <div className="space-y-6">
          {/* Example Tasks */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                <svg className="w-4 h-4 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM9 13a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                </svg>
                Try These
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {exampleTasks.map((example, index) => (
                <button
                  key={index}
                  onClick={() => setTaskInput(example)}
                  className="w-full text-left p-2 text-xs text-gray-700 bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-300 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Email Drafts */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Drafts ({emailDrafts.length})</h3>
              <button
                onClick={loadEmailDrafts}
                className="text-xs text-gray-600 hover:text-gray-900"
              >
                🔄
              </button>
            </div>
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {emailDrafts.length > 0 ? (
                emailDrafts.map((draft) => (
                  <div key={draft.id} className="p-3 hover:bg-gray-50 transition-colors">
                    <p className="text-xs font-medium text-gray-900 truncate">{draft.subject}</p>
                    <p className="text-xs text-gray-600 truncate">To: {draft.to}</p>
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={() => sendDraft(draft.id)}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        Send
                      </button>
                      <button
                        onClick={() => deleteDraft(draft.id)}
                        className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center">
                  <p className="text-xs text-gray-500">No drafts yet</p>
                  <p className="text-xs text-gray-400 mt-1">Drafts will appear here</p>
                </div>
              )}
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 9a1 1 0 11-2 0 1 1 0 012 0zm2 0a1 1 0 11-2 0 1 1 0 012 0zm2 0a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
              </svg>
              How It Works
            </h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>✓ Describe what you want</li>
              <li>✓ AI understands your intent</li>
              <li>✓ Creates draft for review</li>
              <li>✓ You approve and send</li>
            </ul>
          </div>
        </div>
      </div>

      <div ref={messagesEndRef} />
    </div>
  )
}
