# Your Jarvis - Enterprise AI Assistant

A professional, self-hosted RAG (Retrieval-Augmented Generation) assistant with **advanced memory modes**, **citation enforcement**, and **semantic search** capabilities.

> **For detailed documentation, architecture diagrams, and feature explanations, see [README_COMPREHENSIVE.md](./README_COMPREHENSIVE.md)**

## ⚡ Quick Start

### Prerequisites
- Python 3.8+, Node.js 18+
- Ollama: https://ollama.ai/
- 8GB RAM + ~4GB disk

### Setup (5 minutes)
```bash
# 1. Install & run Ollama (separate terminal)
ollama pull llama3.2:1b llama3.2:3b llama3
ollama serve

# 2. Backend
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 3. Frontend (new terminal)
cd frontend && npm install && npm run dev

# 4. Open http://localhost:3000
```

## ✨ Core Features

| Feature | Description |
|---------|-------------|
| 🧠 **Three-Tier Memory** | Stateless / Session / Persistent context modes |
| 🛡️ **Citation Enforcement** | Answers only from verified sources |
| 🔄 **Hybrid Query Modes** | RAG + LLM / Document-only / Generation-only |
| ⚡ **Model Selection** | Ultra Fast / Fast / Balanced / Quality |
| 📄 **Smart Document Management** | Session-based document tracking |
| 📊 **Real-Time Transparency** | Watch AI reasoning with processing steps |
| 💾 **Persistent Storage** | ChromaDB vectors + localStorage history |
| 🔐 **Self-Hosted** | 100% privacy, no external APIs |

## 🏗️ Tech Stack

**Backend**: FastAPI + Python + LLaMA 3 (via Ollama) + ChromaDB + Sentence-Transformers  
**Frontend**: Next.js 14 + React + TypeScript + Tailwind CSS  
**Storage**: ChromaDB (SQLite) + localStorage

## 🎯 What Makes It Unique?

1. **Memory Intelligence**: Choose between stateless queries, session context, or persistent memory
2. **Source Grounding**: Refuse to answer without verified sources (enterprise compliance)
3. **Professional UI**: Technical terminology, real-time processing visualization
4. **Multi-Mode Retrieval**: Flexible hybrid, document-only, or LLM-only modes
5. **Semantic Search**: Vector embeddings for accurate document matching
6. **Complete Privacy**: Self-hosted with zero cloud dependencies

## 📖 Full Documentation

See **[README_COMPREHENSIVE.md](./README_COMPREHENSIVE.md)** for:
- 🎨 UI screenshots & descriptions
- 🏗️ Detailed system architecture & data flow
- 🛠️ Advanced feature implementations
- 📡 API documentation
- 🐛 Troubleshooting guide
- 🎓 Technical terminology reference

## 🎮 Usage Examples

### Example 1: Document Analysis (Stateless)
```
User: "What's the total revenue in Q3?"
Jarvis: Uses only document content, no context carryover
Result: "According to Q3 Report.pdf, revenue was $2.4M"
```

### Example 2: Flowing Conversation (Session Context)
```
User: "Analyze the revenue trend"
Jarvis: Considers current chat history
User: "How does that compare to Q2?"
Jarvis: Remembers "revenue trend" context within session
```

### Example 3: Persistent Analysis (Long-term)
```
Session 1: Analyze Q3 report
Session 2: Analyze Q2 report  
Session 3: "Compare the trends"
Jarvis: Can reference both Q3 and Q2 analysis from prior sessions
```

## 🔧 Environment Variables

```bash
# Backend
OLLAMA_URL=http://localhost:11434/api/generate
MOCK_MODE=false
CORS_ORIGIN=http://localhost:3000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 🚀 Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/chat` | POST | Stream AI response with processing steps |
| `/upload` | POST | Upload document to knowledge base |
| `/knowledge-base` | GET | List all indexed documents |
| `/models` | GET | List available LLM models |
| `/docs` | GET | Interactive API documentation |

## 📊 Performance (8GB System)

- Ultra Fast model: 2-5s response
- Fast model: 5-10s response
- Balanced model: 10-20s response
- Quality model: 20-40s response
- Vector search: <100ms (10k documents)

## 🎨 UI Features

- **Welcome Panel**: Suggested queries, professional description
- **Compact Controls**: Memory mode, query mode, model selection, citation enforcement
- **Real-Time Processing**: Visual steps during query processing
- **Sidebar**: Chat history, knowledge base, document management
- **Session Tracking**: See which documents are in current session
- **Message Avatars**: User (👤) vs Assistant (✨) indicators

## 🔒 Security & Privacy

✅ Self-hosted (no cloud)  
✅ No telemetry  
✅ All data local  
✅ Citation enforcement for accuracy  
✅ Session isolation  

## 🐛 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Ollama connection error | Run `ollama serve` in separate terminal |
| Slow responses | Switch to "Ultra Fast" model |
| Out of memory | Use smaller model or reduce document count |
| CORS error | Check `CORS_ORIGIN` in backend config |
| Documents not retrieved | Try "Hybrid" mode instead of "Document-only" |

## 📚 Architecture Overview

```
Frontend (Next.js) ←→ Backend (FastAPI) ←→ Ollama LLM
    ↓                        ↓                   ↓
localStorage          ChromaDB + Cache    LLaMA 3 Models
```

**Data Flow**: Query → Embeddings → Vector Search → Document Retrieval → Prompt Building → LLM Response → Stream to UI

## 🌟 Advanced Concepts

- **RAG (Retrieval-Augmented Generation)**: Combines document search with AI generation
- **Vector Embeddings**: Text converted to vectors for semantic similarity
- **Citation Enforcement**: Ensures answers are grounded in sources
- **Memory Modes**: Control how context is managed across queries
- **Query Modes**: Choose retrieval strategy (hybrid/document-only/LLM-only)

## 🤝 Contributing

Potential enhancements:
- Additional document formats (DOCX, XLSX)
- Advanced reranking algorithms
- Batch processing optimization
- Custom embedding models
- Admin dashboard

## 📝 License

MIT License

---

**📖 For complete documentation including architecture diagrams, implementation details, API specs, and UI screenshots, see [README_COMPREHENSIVE.md](./README_COMPREHENSIVE.md)**
