from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import chromadb
from sentence_transformers import SentenceTransformer
import requests
import json
from typing import List, Optional, Dict
import uuid
import os
from pathlib import Path
from functools import lru_cache
import hashlib
from config import MODELS, CURRENT_MODEL, MAX_CONTEXT_LENGTH, TOP_K_RESULTS
import PyPDF2
from io import BytesIO
from personal_assistant_routes import router as personal_assistant_router
from email_agent_routes import router as email_agent_router

app = FastAPI(title="Jarvis Assistant API")

# Register routers
app.include_router(personal_assistant_router)
app.include_router(email_agent_router)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="knowledge_base")
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

# Response cache for identical queries
response_cache = {}

# Conversation history storage
conversation_history: Dict[str, List[Dict]] = {}

# Session document tracking
session_documents: Dict[str, List[str]] = {}

# Pydantic models
class ChatMessage(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    mode: Optional[str] = "mixed"  # "context_only", "general_only", "mixed"
    model: Optional[str] = None
    session_doc_ids: Optional[List[str]] = []  # Documents uploaded in this session

class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    sources: List[str] = []
    mode_used: str
    model_used: str
    processing_steps: List[str] = []

class ProcessingUpdate(BaseModel):
    step: str
    status: str  # "started", "completed", "error"
    details: Optional[str] = None

class DocumentUpload(BaseModel):
    content: str
    filename: str
    metadata: Optional[dict] = {}

# Ollama LLM integration
OLLAMA_URL = "http://localhost:11434/api/generate"
MOCK_MODE = os.getenv("MOCK_MODE", "false").lower() == "true"

def query_llama(prompt: str, context: str = "", mode: str = "mixed", model_name: str = None, processing_steps: List[str] = None) -> str:
    """Query LLaMA 3 via Ollama with fallback"""
    
    # Check cache first for speed
    cache_key = hashlib.md5(f"{prompt}:{context}".encode()).hexdigest()
    if cache_key in response_cache:
        print("Using cached response")
        return response_cache[cache_key]
    
    # Mock mode for testing without Ollama
    if MOCK_MODE:
        if context:
            return f"Based on the provided context, here's my response to '{prompt}': This is a mock response. The system found relevant information in the knowledge base and would normally use LLaMA 3 to generate a contextual response."
        else:
            return f"Mock response to '{prompt}': This is a simulated AI response. To get real LLaMA 3 responses, please install and run Ollama with the llama3 model."
    
    if processing_steps is not None:
        processing_steps.append("📝 Creating optimized prompt")
    
    # Create prompt based on mode
    if mode == "context_only":
        if context.strip():
            full_prompt = f"""Answer the question using ONLY the provided document content. Do not use any external knowledge.

DOCUMENT CONTENT:
{context}

USER QUESTION: {prompt}

Answer using only the information above:"""
        else:
            full_prompt = f"I don't have any document content to answer your question. Please upload a document first."
    elif mode == "general_only":
        full_prompt = f"""Answer the question using your general knowledge. Ignore any document context.

USER QUESTION: {prompt}

Answer:"""
    else:  # mixed mode
        if context.strip():
            full_prompt = f"""Answer the question using both the provided document content and your general knowledge for a comprehensive response.

DOCUMENT CONTENT:
{context}

USER QUESTION: {prompt}

Please provide a comprehensive answer combining the document information with relevant general knowledge:"""
        else:
            full_prompt = f"Question: {prompt}\n\nAnswer:"
    
    # Get model configuration
    selected_model = model_name or CURRENT_MODEL
    if selected_model not in MODELS:
        selected_model = CURRENT_MODEL
    model_config = MODELS[selected_model]
    
    if processing_steps is not None:
        processing_steps.append(f"⚡ Connecting to {selected_model} model")
    
    payload = {
        "model": model_config["name"],
        "prompt": full_prompt,
        "stream": False,
        "options": {
            **model_config["options"]
            # Removed stop tokens to allow full responses
        }
    }
    
    try:
        # First check if Ollama is running
        health_response = requests.get("http://localhost:11434/api/tags", timeout=5)
        if health_response.status_code != 200:
            return "Ollama service is not running. Please start Ollama first. Or set MOCK_MODE=true for testing."
        
        # Check if llama3 model is available
        models = health_response.json().get("models", [])
        llama_models = [m for m in models if "llama3" in m.get("name", "").lower()]
        
        if not llama_models:
            return "LLaMA 3 model not found. Please run: ollama pull llama3"
        
        # Query the model with longer timeout for first requests
        print(f"Sending request to LLaMA with prompt length: {len(full_prompt)}")
        response = requests.post(OLLAMA_URL, json=payload, timeout=180)
        response.raise_for_status()
        result = response.json()["response"]
        print(f"LLaMA response received: {len(result)} characters")
        
        # Cache the response for future use
        response_cache[cache_key] = result
        # Limit cache size to prevent memory issues
        if len(response_cache) > 50:
            # Remove oldest entries
            oldest_key = next(iter(response_cache))
            del response_cache[oldest_key]
        
        return result
        
    except requests.exceptions.ConnectionError:
        return "Cannot connect to Ollama. Please ensure Ollama is running on localhost:11434. Or set MOCK_MODE=true for testing."
    except requests.exceptions.Timeout:
        return "LLaMA response timed out. The model might be loading or the query is too complex."
    except Exception as e:
        return f"Error connecting to LLaMA: {str(e)}"

@lru_cache(maxsize=100)
def get_cached_embedding(query: str):
    """Cache embeddings for repeated queries"""
    return embedding_model.encode([query]).tolist()

def retrieve_context(query: str, top_k: int = TOP_K_RESULTS, processing_steps: List[str] = None, session_doc_ids: List[str] = None) -> tuple[str, List[str]]:
    """Retrieve relevant context from vector database"""
    try:
        if processing_steps is not None:
            processing_steps.append("🔤 Generating query embedding")
        
        # Use cached embedding for speed
        query_embedding = get_cached_embedding(query)
        
        # Processing steps are now handled in the main chat function
        
        # Filter by session documents if provided
        where_filter = None
        if session_doc_ids and len(session_doc_ids) > 0:
            where_filter = {"doc_id": {"$in": session_doc_ids}}
        
        results = collection.query(
            query_embeddings=query_embedding,
            n_results=top_k,
            where=where_filter if where_filter else None
        )
        
        # Debug info (can be removed later)
        print(f"Documents found: {len(results.get('documents', []))}")
        
        if results['documents'] and results['documents'][0]:
            # Limit context length for faster processing
            context_parts = results['documents'][0]
            limited_context = []
            total_length = 0
            
            for part in context_parts:
                # Always include at least the first chunk, even if it's long
                if len(limited_context) == 0 or total_length + len(part) <= MAX_CONTEXT_LENGTH:
                    limited_context.append(part)
                    total_length += len(part)
                else:
                    break
            
            context = "\n\n".join(limited_context)
            sources = [meta.get('filename', 'Unknown') for meta in results['metadatas'][0]]
            
            if processing_steps is not None:
                processing_steps.append(f"📄 Found {len(context_parts)} relevant chunks, using {len(limited_context)} for context")
            
            print(f"Retrieved {len(context_parts)} context parts, using {len(limited_context)}")
            return context, sources
        return "", []
    except Exception as e:
        print(f"Error retrieving context: {e}")
        return "", []

@app.get("/")
async def root():
    return {"message": "Jarvis Assistant API is running"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test ChromaDB connection
        count = collection.count()
        
        # Test embedding model
        test_embedding = embedding_model.encode(["test"])
        
        return {
            "status": "healthy",
            "chroma_documents": count,
            "embedding_model": "loaded"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }

@app.post("/chat", response_model=ChatResponse)
async def chat(message: ChatMessage):
    """Main chat endpoint"""
    try:
        # Generate conversation ID if not provided
        conv_id = message.conversation_id or str(uuid.uuid4())
        
        # Initialize processing steps
        processing_steps = []
        processing_steps.append(f"🚀 Starting query processing (Mode: {message.mode.replace('_', ' ').title()})")
        
        print(f"Processing chat message: {message.message}")
        print(f"Mode: {message.mode}, Model: {message.model}")
        
        # Get knowledge base stats for dynamic messaging
        total_docs = collection.count()
        
        # Retrieve relevant context based on mode
        context = ""
        sources = []
        
        if message.mode in ["mixed", "context_only"]:
            if message.session_doc_ids and len(message.session_doc_ids) > 0:
                processing_steps.append(f"🔍 Searching {len(message.session_doc_ids)} session documents")
            else:
                processing_steps.append(f"🔍 Searching {total_docs} documents in knowledge base")
            
            context, sources = retrieve_context(
                message.message, 
                processing_steps=processing_steps,
                session_doc_ids=message.session_doc_ids
            )
            print(f"Retrieved context from {len(sources)} sources")
            print(f"Context preview: {context[:200]}..." if context else "No context")
            print(f"Full context length: {len(context)}")
        else:
            processing_steps.append("🧠 Using general knowledge only (skipping document search)")
        
        # Query LLaMA
        processing_steps.append(f"🤖 Generating response with {message.model.replace('_', ' ').title()} model")
        response = query_llama(
            message.message, 
            context, 
            mode=message.mode or "mixed",
            model_name=message.model,
            processing_steps=processing_steps
        )
        
        processing_steps.append("✅ Response generated successfully")
        
        # Store conversation history
        if conv_id not in conversation_history:
            conversation_history[conv_id] = []
        
        conversation_history[conv_id].append({
            "role": "user",
            "content": message.message,
            "timestamp": str(uuid.uuid4())
        })
        conversation_history[conv_id].append({
            "role": "assistant",
            "content": response,
            "sources": sources,
            "timestamp": str(uuid.uuid4())
        })
        
        chat_response = ChatResponse(
            response=response,
            conversation_id=conv_id,
            sources=sources,
            mode_used=message.mode or "mixed",
            model_used=message.model or CURRENT_MODEL,
            processing_steps=processing_steps
        )
        print(f"Returning chat response with {len(processing_steps)} processing steps")
        return chat_response
    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload-document")
async def upload_document(file: UploadFile = File(...), conversation_id: str = None):
    """Upload and process documents for knowledge base"""
    try:
        # Read file content
        content = await file.read()
        
        # Handle different file types
        if file.filename.endswith('.pdf'):
            # PDF processing with PyPDF2
            try:
                pdf_file = BytesIO(content)
                pdf_reader = PyPDF2.PdfReader(pdf_file)
                text_content = ""
                
                # Extract text from all pages
                for page_num in range(len(pdf_reader.pages)):
                    page = pdf_reader.pages[page_num]
                    text_content += page.extract_text() + "\n\n"
                
                if not text_content.strip():
                    raise HTTPException(status_code=400, detail="No text found in PDF. It might be scanned or image-based.")
                
                print(f"Extracted {len(text_content)} characters from PDF")
            except Exception as e:
                print(f"PDF parsing error: {str(e)}")
                raise HTTPException(status_code=400, detail=f"Error parsing PDF: {str(e)}")
        else:
            # Handle text files
            try:
                text_content = content.decode('utf-8')
            except UnicodeDecodeError:
                try:
                    text_content = content.decode('latin-1')
                except UnicodeDecodeError:
                    raise HTTPException(status_code=400, detail="Unable to decode file. Please ensure it's a valid text file.")
        
        # Simple text chunking (split by paragraphs)
        chunks = [chunk.strip() for chunk in text_content.split('\n\n') if chunk.strip()]
        
        if not chunks:
            # If no paragraphs, split by sentences or lines
            chunks = [chunk.strip() for chunk in text_content.split('\n') if chunk.strip()]
        
        if not chunks:
            raise HTTPException(status_code=400, detail="No content found in the file")
        
        # Limit chunk size to avoid memory issues
        max_chunks = 100
        if len(chunks) > max_chunks:
            chunks = chunks[:max_chunks]
        
        # Generate embeddings and store
        print(f"Processing {len(chunks)} chunks from {file.filename}")
        embeddings = embedding_model.encode(chunks)
        
        # Create unique document ID for this upload
        import time
        timestamp = int(time.time())
        doc_id = f"doc_{timestamp}_{uuid.uuid4().hex[:8]}"
        
        # Create unique IDs for chunks
        ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [{
            "filename": file.filename, 
            "chunk_id": i, 
            "timestamp": timestamp,
            "doc_id": doc_id
        } for i in range(len(chunks))]
        
        # Add to collection
        collection.add(
            embeddings=embeddings.tolist(),
            documents=chunks,
            metadatas=metadatas,
            ids=ids
        )
        
        # Track document for session if conversation_id provided
        if conversation_id:
            if conversation_id not in session_documents:
                session_documents[conversation_id] = []
            session_documents[conversation_id].append(doc_id)
        
        return {
            "message": f"Successfully uploaded {file.filename} with {len(chunks)} chunks",
            "doc_id": doc_id,
            "chunks": len(chunks)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing file {file.filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.get("/knowledge-base/stats")
async def get_knowledge_stats():
    """Get statistics about the knowledge base"""
    try:
        count = collection.count()
        return {"total_documents": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/knowledge-base/inspect")
async def inspect_knowledge_base():
    """Inspect the contents of the knowledge base"""
    try:
        # Get all documents
        results = collection.get()
        return {
            "total_count": len(results.get('documents', [])),
            "documents": results.get('documents', [])[:5],  # First 5 documents
            "metadatas": results.get('metadatas', [])[:5],   # First 5 metadata entries
            "ids": results.get('ids', [])[:5]                # First 5 IDs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models")
async def get_available_models():
    """Get available model configurations"""
    return {
        "current": CURRENT_MODEL,
        "available": MODELS
    }

@app.post("/models/{model_name}")
async def switch_model(model_name: str):
    """Switch to a different model configuration"""
    global CURRENT_MODEL
    if model_name not in MODELS:
        raise HTTPException(status_code=400, detail=f"Model {model_name} not available. Choose from: {list(MODELS.keys())}")
    
    CURRENT_MODEL = model_name
    return {
        "message": f"Switched to {model_name} model",
        "config": MODELS[model_name]
    }

@app.post("/chat/stream")
async def chat_stream(message: ChatMessage):
    """Streaming chat endpoint with real-time processing updates"""
    import asyncio
    import json
    
    async def generate_response():
        try:
            # Generate conversation ID if not provided
            conv_id = message.conversation_id or str(uuid.uuid4())
            
            # Send initial status
            yield f"data: {json.dumps({'type': 'status', 'step': 'Starting query processing', 'conversation_id': conv_id})}\n\n"
            await asyncio.sleep(0.2)
            
            # Retrieve relevant context based on mode
            context = ""
            sources = []
            
            # Get knowledge base stats for dynamic messaging
            total_docs = collection.count()
            
            if message.mode in ["mixed", "context_only"]:
                if message.session_doc_ids and len(message.session_doc_ids) > 0:
                    yield f"data: {json.dumps({'type': 'status', 'step': f'🔍 Searching {len(message.session_doc_ids)} session documents'})}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'status', 'step': f'🔍 Searching {total_docs} documents in knowledge base'})}\n\n"
                await asyncio.sleep(0.3)
                
                yield f"data: {json.dumps({'type': 'status', 'step': '🔤 Generating query embedding'})}\n\n"
                await asyncio.sleep(0.2)
                
                context, sources = retrieve_context(
                    message.message,
                    session_doc_ids=message.session_doc_ids
                )
                
                if sources:
                    yield f"data: {json.dumps({'type': 'status', 'step': f'📄 Found {len(sources)} relevant documents'})}\n\n"
                    await asyncio.sleep(0.2)
                else:
                    yield f"data: {json.dumps({'type': 'status', 'step': '❌ No relevant documents found in knowledge base'})}\n\n"
                    await asyncio.sleep(0.2)
            else:
                yield f"data: {json.dumps({'type': 'status', 'step': '🧠 Using general knowledge only (skipping document search)'})}\n\n"
                await asyncio.sleep(0.3)
            
            # Model selection and prompt creation
            selected_model = message.model or CURRENT_MODEL
            model_config = MODELS.get(selected_model, MODELS[CURRENT_MODEL])
            
            model_description = model_config["description"]
            step_message = f'⚡ Using {selected_model.replace("_", " ").title()} model'
            yield f"data: {json.dumps({'type': 'status', 'step': step_message})}\n\n"
            await asyncio.sleep(0.2)
            
            yield f"data: {json.dumps({'type': 'status', 'step': '📝 Creating optimized prompt'})}\n\n"
            await asyncio.sleep(0.2)
            
            yield f"data: {json.dumps({'type': 'status', 'step': '🔗 Connecting to LLaMA model via Ollama'})}\n\n"
            await asyncio.sleep(0.3)
            
            # Query LLaMA
            yield f"data: {json.dumps({'type': 'status', 'step': '🤖 Generating AI response (this may take a moment)'})}\n\n"
            await asyncio.sleep(0.2)
            
            response = query_llama(
                message.message, 
                context, 
                mode=message.mode or "mixed",
                model_name=message.model
            )
            
            yield f"data: {json.dumps({'type': 'status', 'step': '✅ Response generated successfully'})}\n\n"
            await asyncio.sleep(0.2)
            
            yield f"data: {json.dumps({'type': 'status', 'step': '📋 Finalizing response and metadata'})}\n\n"
            await asyncio.sleep(0.1)
            
            # Store conversation history
            if conv_id not in conversation_history:
                conversation_history[conv_id] = []
            
            conversation_history[conv_id].append({
                "role": "user",
                "content": message.message,
                "timestamp": str(uuid.uuid4())
            })
            conversation_history[conv_id].append({
                "role": "assistant",
                "content": response,
                "sources": sources,
                "timestamp": str(uuid.uuid4())
            })
            
            # Send final response
            chat_response = {
                'type': 'response',
                'response': response,
                'conversation_id': conv_id,
                'sources': sources,
                'mode_used': message.mode or "mixed",
                'model_used': message.model or CURRENT_MODEL
            }
            
            yield f"data: {json.dumps(chat_response)}\n\n"
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            error_response = {
                'type': 'error',
                'error': str(e)
            }
            yield f"data: {json.dumps(error_response)}\n\n"
    
    return StreamingResponse(
        generate_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    )

@app.post("/cache/clear")
async def clear_cache():
    """Clear response cache"""
    global response_cache
    cache_size = len(response_cache)
    response_cache.clear()
    get_cached_embedding.cache_clear()
    return {"message": f"Cleared {cache_size} cached responses and embeddings"}

@app.get("/conversation/{conversation_id}/history")
async def get_conversation_history(conversation_id: str):
    """Get conversation history for a specific conversation"""
    if conversation_id not in conversation_history:
        return {"messages": []}
    return {"messages": conversation_history[conversation_id]}

@app.get("/conversation/{conversation_id}/documents")
async def get_session_documents(conversation_id: str):
    """Get documents uploaded in this session"""
    if conversation_id not in session_documents:
        return {"doc_ids": []}
    return {"doc_ids": session_documents[conversation_id]}

@app.delete("/conversation/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete a conversation and its history"""
    deleted = False
    if conversation_id in conversation_history:
        del conversation_history[conversation_id]
        deleted = True
    if conversation_id in session_documents:
        del session_documents[conversation_id]
        deleted = True
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {"message": f"Conversation {conversation_id} deleted"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)