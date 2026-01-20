# RAG Pipeline Integration Plan for ARUS

**Date:** November 12, 2025  
**Objective:** Add OCR-enabled RAG (Retrieval-Augmented Generation) pipeline for marine equipment manuals, oil analysis reports, and survey documents

---

## Executive Summary

This plan adapts the proposed RAG pipeline to ARUS's existing architecture, providing semantic search over equipment manuals, automated oil report parsing, and AI-powered diagnostic assistance.

### Business Value
- **Faster Diagnostics:** Instant access to relevant manual sections when equipment issues arise
- **Automated Oil Analysis:** OCR scanned lab reports and auto-populate telemetry data
- **Knowledge Retention:** Build organizational knowledge base from PDFs, scans, and manuals
- **AI-Powered Insights:** Combine RAG context with existing ML models for better predictions

---

## Architecture Review

### Current ARUS Stack ✅
- ✅ PostgreSQL with TimescaleDB (Neon cloud)
- ✅ OpenAI SDK installed (`openai@5.22.1`)
- ✅ Multi-tenant architecture (`org_id` scoping)
- ✅ Drizzle ORM with schema in `@shared/schema.ts`
- ✅ Express backend with Zod validation
- ✅ React frontend with shadcn/ui

### Gaps to Address ❌
- ❌ **pgvector extension not installed** - Needs database migration
- ❌ No document ingestion pipeline
- ❌ No OCR capabilities
- ❌ No semantic search infrastructure

---

## Adaptation Strategy

### Why Adapt (Not Direct Copy)?

1. **ARUS Conventions:** Match existing patterns for storage, routes, and API design
2. **Security First:** Add admin auth, rate limiting, and audit logging (lessons from ML reset!)
3. **Error Handling:** Robust error handling matching ARUS standards
4. **UI/UX:** Follow ARUS design system (dark mode, mobile-first, accessibility)
5. **Testing:** Add data-testid attributes and proper validation

### Key Modifications

| Proposal | ARUS Adaptation | Reason |
|----------|-----------------|--------|
| Simple Router | Full route integration in `server/routes.ts` | Centralized route management |
| Basic error handling | Try-catch with detailed logging | Production error tracking |
| No auth checks | Admin-only with `requireAdminAuth` | Secure destructive operations |
| Alert-based UI | Toast notifications | Consistent UX |
| Hardcoded paths | Environment-based config | Cloud deployment ready |
| No validation | Zod schema validation | Type safety + runtime checks |

---

## Implementation Plan (12 Phases)

### Phase 1: Database Setup ⚙️

**Objective:** Enable pgvector and create knowledge base tables

**Tasks:**
1. Enable pgvector extension on PostgreSQL
2. Add Drizzle schema for `kb_docs` and `kb_chunks`
3. Create database migration SQL
4. Add insert/select schemas with Zod

**Files to Create/Modify:**
- `shared/schema.ts` - Add `kbDocs` and `kbChunks` tables
- Database migration via `npm run db:push`

**Schema Decisions:**
- Use `varchar` IDs (consistent with ARUS)
- 384-dimensional vectors (Xenova/MiniLM) as default
- Optional 1536-dim support for OpenAI fallback
- JSONB metadata for extensibility
- Cascade deletes (docs → chunks)

**Validation:**
```sql
SELECT extname FROM pg_extension WHERE extname = 'vector';
SELECT count(*) FROM kb_docs;
SELECT count(*) FROM kb_chunks;
```

---

### Phase 2: Package Dependencies 📦

**Objective:** Install required npm packages

**Core RAG:**
```bash
npm i pdf-parse tesseract.js sharp @xenova/transformers pgvector
```

**File Upload:**
```bash
npm i multer @types/multer
```

**Already Installed:**
- ✅ `openai` - For OpenAI fallback embeddings
- ✅ `langchain` - For LLM orchestration (optional)

**Size Considerations:**
- `@xenova/transformers` (~300MB) - Large download, cache model files
- `tesseract.js` - Downloads language data on first run
- `sharp` - Native dependencies (ensure build succeeds on Replit)

---

### Phase 3: Embedding Service 🧠

**Objective:** Create dual-mode embedding provider (local + OpenAI fallback)

**File:** `server/rag/embeddings.ts`

**Key Features:**
- Local: Xenova/all-MiniLM-L6-v2 (384-dim, free, runs on CPU)
- Fallback: OpenAI text-embedding-3-small (1536-dim, paid, requires API key)
- Environment flag: `EMBEDDINGS_PROVIDER=local|openai`
- Batch processing for performance
- Caching for repeated queries

**Enhancements vs Proposal:**
```typescript
// Add caching layer
const embeddingCache = new Map<string, number[]>();

export async function embedBatch(texts: string[]): Promise<number[][]> {
  // Check cache first
  const results: number[][] = [];
  const uncached: string[] = [];
  
  for (const text of texts) {
    if (embeddingCache.has(text)) {
      results.push(embeddingCache.get(text)!);
    } else {
      uncached.push(text);
    }
  }
  
  // Batch compute uncached
  if (uncached.length > 0) {
    const newEmbeddings = await computeEmbeddings(uncached);
    for (let i = 0; i < uncached.length; i++) {
      embeddingCache.set(uncached[i], newEmbeddings[i]);
      results.push(newEmbeddings[i]);
    }
  }
  
  return results;
}

// Add error handling + retry logic
// Add performance monitoring (embedding time)
// Add batch size limits (prevent OOM)
```

---

### Phase 4: Document Ingestion Pipeline 📄

**Objective:** Extract text from PDFs and images with OCR

**File:** `server/rag/ingest.ts`

**Supported Formats:**
- PDFs (native text extraction via `pdf-parse`)
- Images (OCR via `tesseract.js`): PNG, JPG, JPEG, TIF, TIFF, BMP
- Scanned PDFs (hybrid: extract + OCR fallback)

**Enhancements vs Proposal:**
1. **Progress Tracking:** Report ingestion progress to client via SSE or polling
2. **Error Recovery:** Continue on chunk failure, report partial success
3. **Metadata Extraction:** Extract PDF metadata (author, creation date, etc.)
4. **Language Detection:** Support multi-language OCR (eng, chi_sim, etc.)
5. **File Validation:** Check file size, type, and virus scanning
6. **Deduplication:** Hash-based duplicate detection

**File Processing Flow:**
```
Upload → Validate → Extract Text → Chunk → Embed → Store → Cleanup
```

**Chunking Strategy:**
```typescript
function chunkText(text: string, options = {
  targetSize: 1000,      // Target chunk size in chars
  overlapSize: 100,      // Overlap for context continuity
  respectSentences: true, // Break at sentence boundaries
  maxSize: 1500          // Hard limit
}): string[] {
  // Improved chunking with overlap and boundaries
}
```

**Storage:**
- Temp files in `/tmp/uploads/` (auto-cleanup after 24h)
- Original files optionally stored in Replit Object Storage
- Database stores: chunks, embeddings, metadata

---

### Phase 5: Oil Report Parser 🛢️

**Objective:** Extract structured data from OCR'd oil analysis reports

**File:** `server/rag/oil-report.ts`

**Extracted Metrics:**
- Viscosity (cSt @ 40°C, 100°C)
- Wear metals (Fe, Cu, Pb, Al ppm)
- Contaminants (Si, Na ppm)
- Condition indicators (Soot %, Water %, TBN, TAN)

**Enhancements vs Proposal:**
1. **ISO 4406 Codes:** Parse particle count codes (e.g., "18/16/13")
2. **Trend Analysis:** Compare with historical reports for same equipment
3. **Alert Integration:** Auto-create alerts for critical values
4. **Telemetry Mapping:** Map parsed values to equipment telemetry channels
5. **Multi-Format Support:** Different lab formats (SGS, Intertek, Bureau Veritas)

**Integration with Existing ARUS Features:**
```typescript
// After parsing oil report
async function integrateOilReport(report: OilReport, equipmentId: string) {
  // 1. Store as telemetry
  await storage.createTelemetry({
    equipmentId,
    timestamp: new Date(),
    values: {
      oil_iron_ppm: report.iron_ppm,
      oil_copper_ppm: report.copper_ppm,
      // ... map all metrics
    }
  });
  
  // 2. Trigger anomaly detection
  const anomalies = await detectOilAnomalies(report, equipmentId);
  
  // 3. Update equipment health score
  await updateEquipmentHealth(equipmentId);
  
  // 4. Create alerts if thresholds exceeded
  if (report.iron_ppm > 60) {
    await createAlert({
      equipmentId,
      severity: 'high',
      message: 'High wear metal detected in oil analysis'
    });
  }
}
```

---

### Phase 6: Vector Search Service 🔍

**Objective:** Semantic search over knowledge base

**File:** `server/rag/search.ts`

**Search Modes:**
1. **Semantic Search:** Vector similarity (cosine/L2)
2. **Hybrid Search:** Vector + keyword (BM25)
3. **Filtered Search:** Metadata filters (doc type, date range, equipment type)

**Enhancements vs Proposal:**
```typescript
interface SearchOptions {
  query: string;
  k?: number;              // Top K results
  filters?: {
    docTypes?: string[];   // Filter by document type
    equipmentTypes?: string[]; // Relevant to equipment
    dateRange?: { from: Date; to: Date };
  };
  rerank?: boolean;        // Re-rank using cross-encoder
  includeContext?: boolean; // Return surrounding chunks
}

export async function searchKb(
  orgId: string,
  options: SearchOptions
): Promise<SearchResult[]> {
  // 1. Embed query
  const [queryEmb] = await embedBatch([options.query]);
  
  // 2. Vector search with filters
  const results = await vectorSearch(orgId, queryEmb, options);
  
  // 3. Optional re-ranking
  if (options.rerank) {
    results = await rerankResults(options.query, results);
  }
  
  // 4. Include context chunks
  if (options.includeContext) {
    results = await addContextChunks(results);
  }
  
  return results;
}
```

**Performance Optimizations:**
- HNSW index for fast ANN search
- Result caching (Redis)
- Query preprocessing (normalization, stop word removal)
- Pagination for large result sets

---

### Phase 7: API Routes (ARUS-Style) 🛤️

**Objective:** RESTful API endpoints with ARUS conventions

**File:** `server/routes.ts` (add to existing routes)

**Endpoints:**

```typescript
// Knowledge Base Document Management
POST   /api/kb/docs/upload        - Upload document (admin-only)
GET    /api/kb/docs               - List documents (paginated)
GET    /api/kb/docs/:id           - Get document details
DELETE /api/kb/docs/:id           - Delete document (admin-only)

// Search & Retrieval
POST   /api/kb/search             - Semantic search
POST   /api/kb/diagnose           - AI diagnostic with RAG context

// Oil Report Processing
POST   /api/kb/oil-report/upload  - Upload scanned oil report
POST   /api/kb/oil-report/parse   - Parse OCR text to structured data
GET    /api/kb/oil-reports        - List parsed reports
```

**ARUS-Style Implementation:**
```typescript
// Add to server/routes.ts
app.post(
  "/api/kb/docs/upload",
  requireAdminAuth,                    // ✅ Auth middleware
  uploadLimiter,                        // ✅ Rate limiting
  auditAdminAction("UPLOAD_KB_DOC"),   // ✅ Audit logging
  upload.single("file"),                // Multer middleware
  async (req, res) => {
    try {
      // Validate
      const { orgId } = req.user!;
      if (!req.file) {
        return res.status(400).json({ 
          error: "file required" 
        });
      }
      
      // Validate file type
      const allowedTypes = ['.pdf', '.png', '.jpg', '.jpeg'];
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (!allowedTypes.includes(ext)) {
        return res.status(400).json({
          error: "Invalid file type",
          allowed: allowedTypes
        });
      }
      
      // Ingest
      const result = await ingestFileToKb(
        req.file.path,
        orgId
      );
      
      // Cleanup
      await fs.unlink(req.file.path);
      
      res.json({
        success: true,
        docId: result.createdDocId,
        chunks: result.chunks,
        message: `Ingested ${result.chunks} chunks`
      });
      
    } catch (error) {
      console.error("KB upload failed:", error);
      res.status(500).json({
        error: "Upload failed",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
);
```

**Validation Schemas:**
```typescript
import { z } from "zod";

const searchSchema = z.object({
  query: z.string().min(1).max(500),
  k: z.number().int().min(1).max(20).optional(),
  filters: z.object({
    docTypes: z.array(z.string()).optional(),
    equipmentTypes: z.array(z.string()).optional(),
  }).optional()
});

const oilReportSchema = z.object({
  equipmentId: z.string().uuid(),
  reportDate: z.string().datetime(),
  raw: z.string().min(1),
});
```

---

### Phase 8: Frontend - Knowledge Base Page 🎨

**Objective:** Admin UI for document management and search

**File:** `client/src/pages/knowledge-base.tsx`

**Features:**
1. **Document Upload:** Drag-drop interface with progress bar
2. **Document Library:** Table view with search/filter
3. **Semantic Search:** Search interface with results highlighting
4. **Oil Report Viewer:** Parsed data visualization
5. **Diagnostic Assistant:** Chat-like interface for equipment queries

**ARUS-Style UI:**
```tsx
export default function KnowledgeBasePage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Knowledge Base</h1>
        <Button data-testid="button-upload-doc">
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>
      
      <Tabs defaultValue="documents">
        {/* Documents Tab */}
        <TabsContent value="documents">
          <DocumentLibrary />
        </TabsContent>
        
        {/* Search Tab */}
        <TabsContent value="search">
          <SemanticSearch />
        </TabsContent>
        
        {/* Oil Reports Tab */}
        <TabsContent value="oil-reports">
          <OilReportManager />
        </TabsContent>
        
        {/* Diagnostic Assistant Tab */}
        <TabsContent value="assistant">
          <DiagnosticAssistant />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Components:**
- `<DocumentUploader />` - Drag-drop with validation
- `<DocumentLibrary />` - Table with pagination
- `<SemanticSearch />` - Search input + results
- `<OilReportViewer />` - Parsed data cards
- `<DiagnosticAssistant />` - Chat interface with RAG

**Mobile Optimization:**
- Responsive cards for mobile
- Touch-friendly upload area
- Collapsible search results

---

### Phase 9: Integration with Existing Features 🔗

**Objective:** Connect RAG to ARUS PdM features

#### A) Equipment Diagnostics Enhancement
```typescript
// In equipment detail page, add "Ask AI" button
async function diagnoseWithRAG(equipmentId: string, symptom: string) {
  // 1. Get equipment context
  const equipment = await storage.getEquipment(equipmentId);
  
  // 2. Search relevant manual sections
  const manualSections = await searchKb(orgId, {
    query: `${equipment.type} ${symptom}`,
    filters: { equipmentTypes: [equipment.type] },
    k: 3
  });
  
  // 3. Get recent telemetry
  const telemetry = await storage.getRecentTelemetry(equipmentId);
  
  // 4. Combine with LLM
  const diagnosis = await generateDiagnosis({
    equipment,
    symptom,
    manualContext: manualSections,
    telemetryData: telemetry
  });
  
  return diagnosis;
}
```

#### B) Oil Analysis Integration
```typescript
// Auto-process uploaded oil reports
async function processOilReport(file: File, equipmentId: string) {
  // 1. Ingest to KB
  const { createdDocId } = await ingestFileToKb(file.path, orgId);
  
  // 2. Extract text
  const { text } = await extractText(file.path);
  
  // 3. Parse oil metrics
  const parsed = parseOilReport(text);
  
  // 4. Store as telemetry
  await storage.createTelemetry({
    equipmentId,
    timestamp: new Date(),
    sensorType: 'oil_analysis',
    values: parsed
  });
  
  // 5. Trigger anomaly detection
  await checkOilAnomalies(equipmentId, parsed);
  
  return { docId: createdDocId, parsed };
}
```

#### C) Maintenance Recommendations
```typescript
// Enhance maintenance planning with manual references
async function suggestMaintenance(equipmentId: string) {
  const equipment = await storage.getEquipment(equipmentId);
  const predictions = await getPredictions(equipmentId);
  
  // Search maintenance procedures in manuals
  const procedures = await searchKb(orgId, {
    query: `${equipment.type} maintenance procedure preventive`,
    filters: { docTypes: ['manual', 'service_guide'] }
  });
  
  return {
    predictions,
    recommendedActions: procedures,
    estimatedCost: calculateMaintenanceCost(procedures)
  };
}
```

---

### Phase 10: Security & Performance 🔒

**Security Measures:**
1. **File Upload Validation:**
   - Max file size: 50MB
   - Allowed MIME types whitelist
   - Virus scanning (ClamAV integration optional)
   - Filename sanitization

2. **Access Control:**
   - Document upload: Admin-only
   - Document search: Org-scoped
   - Audit all document operations

3. **Rate Limiting:**
   ```typescript
   const uploadLimiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 10, // 10 uploads per window
     message: "Too many uploads, try again later"
   });
   ```

4. **Data Sanitization:**
   - Strip HTML from extracted text
   - Validate embedding dimensions
   - SQL injection prevention (parameterized queries)

**Performance Optimizations:**
1. **Embedding Cache:** Redis cache for query embeddings
2. **Vector Index:** HNSW index on `kb_chunks.embedding`
3. **Batch Processing:** Process multiple chunks in parallel
4. **Lazy Loading:** Defer model loading until first use
5. **CDN:** Serve model files from CDN

---

### Phase 11: Testing Strategy 🧪

**Unit Tests:**
```typescript
// server/rag/__tests__/embeddings.test.ts
describe('Embedding Service', () => {
  it('generates 384-dim embeddings for local provider', async () => {
    const [emb] = await embedBatch(['test']);
    expect(emb).toHaveLength(384);
  });
  
  it('falls back to OpenAI when configured', async () => {
    process.env.EMBEDDINGS_PROVIDER = 'openai';
    const [emb] = await embedBatch(['test']);
    expect(emb).toHaveLength(1536);
  });
});

// server/rag/__tests__/oil-report.test.ts
describe('Oil Report Parser', () => {
  it('parses iron ppm from OCR text', () => {
    const text = 'Iron: 75 ppm';
    const report = parseOilReport(text);
    expect(report.iron_ppm).toBe(75);
  });
  
  it('generates alerts for high values', () => {
    const text = 'Iron: 75 ppm, Copper: 45 ppm';
    const report = parseOilReport(text);
    expect(report.notes).toContain('High wear metal: iron');
  });
});
```

**Integration Tests:**
```typescript
// Test full upload → ingest → search flow
describe('RAG Pipeline E2E', () => {
  it('ingests PDF and enables search', async () => {
    // Upload
    const upload = await request(app)
      .post('/api/kb/docs/upload')
      .attach('file', 'fixtures/manual.pdf')
      .expect(200);
    
    expect(upload.body.chunks).toBeGreaterThan(0);
    
    // Search
    const search = await request(app)
      .post('/api/kb/search')
      .send({ query: 'engine maintenance' })
      .expect(200);
    
    expect(search.body.results.length).toBeGreaterThan(0);
  });
});
```

**E2E Tests (Playwright):**
```typescript
test('upload and search document via UI', async ({ page }) => {
  await page.goto('/knowledge-base');
  
  // Upload
  await page.setInputFiles('[data-testid="input-file-upload"]', 'manual.pdf');
  await page.click('[data-testid="button-upload"]');
  await expect(page.locator('.toast')).toContainText('Ingested');
  
  // Search
  await page.fill('[data-testid="input-search"]', 'maintenance');
  await page.click('[data-testid="button-search"]');
  await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
});
```

---

### Phase 12: Deployment & Monitoring 🚀

**Environment Variables:**
```bash
# .env additions
EMBEDDINGS_PROVIDER=local          # local | openai
OPENAI_API_KEY=sk-...              # Optional for fallback
PGVECTOR_ENABLED=true
RAG_UPLOAD_MAX_SIZE_MB=50
RAG_CHUNK_SIZE=1000
RAG_CHUNK_OVERLAP=100
TESSERACT_LANG=eng                 # OCR language
```

**Database Migration:**
```bash
# Enable pgvector
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Push schema
npm run db:push
```

**Monitoring Metrics:**
```typescript
// Track RAG performance
const ragMetrics = {
  documents_ingested: counter,
  chunks_created: counter,
  search_queries: counter,
  embedding_time_ms: histogram,
  search_time_ms: histogram,
  ocr_success_rate: gauge,
  storage_size_mb: gauge
};
```

**Health Checks:**
```typescript
app.get('/api/kb/health', async (req, res) => {
  const checks = {
    pgvector: await checkPgVector(),
    embeddings: await checkEmbeddings(),
    storage: await checkStorage()
  };
  
  const healthy = Object.values(checks).every(c => c.ok);
  res.status(healthy ? 200 : 503).json(checks);
});
```

---

## Risk Assessment & Mitigation

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| pgvector not available on Neon | High | Low | Use Supabase or self-hosted Postgres as fallback |
| @xenova/transformers too slow | Medium | Medium | Default to OpenAI, cache aggressively |
| OCR quality poor on scanned docs | Medium | High | Preprocessing with sharp, manual review UI |
| Large model files (300MB+) | Low | High | CDN serving, lazy loading |
| Search relevance low | Medium | Medium | Hybrid search, re-ranking, user feedback |

### Operational Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Storage costs (embeddings) | Medium | Compression, deduplication, archival |
| API rate limits (OpenAI) | Medium | Local embeddings as default |
| User upload spam | High | Rate limiting, file validation, admin-only |
| PII in documents | High | OCR redaction, GDPR compliance |

---

## Success Metrics

**Quantitative:**
- ✅ 95% document ingestion success rate
- ✅ <5s average search response time
- ✅ >80% search relevance (user feedback)
- ✅ 50+ manuals ingested in first month
- ✅ 20+ oil reports processed per week

**Qualitative:**
- ✅ Marine engineers can find manual sections in <30s
- ✅ Oil reports auto-populate telemetry without manual entry
- ✅ Diagnostic assistant provides actionable recommendations
- ✅ Zero security incidents related to document uploads

---

## Timeline Estimate

| Phase | Estimated Time | Dependencies |
|-------|---------------|--------------|
| Phase 1: Database Setup | 2-3 hours | pgvector installation |
| Phase 2: Dependencies | 1 hour | npm install |
| Phase 3: Embeddings | 3-4 hours | Model download, testing |
| Phase 4: Ingestion | 6-8 hours | PDF parsing, OCR testing |
| Phase 5: Oil Parser | 4-5 hours | Regex patterns, validation |
| Phase 6: Search | 4-5 hours | Vector queries, optimization |
| Phase 7: API Routes | 5-6 hours | ARUS integration, validation |
| Phase 8: Frontend | 8-10 hours | UI components, testing |
| Phase 9: Integration | 6-8 hours | Equipment diagnostics |
| Phase 10: Security | 3-4 hours | Rate limiting, validation |
| Phase 11: Testing | 6-8 hours | Unit, integration, E2E |
| Phase 12: Deployment | 2-3 hours | Migration, monitoring |

**Total:** 50-65 hours (6-8 days for single developer)

---

## Next Steps

1. **Review & Approve:** Get stakeholder sign-off on plan
2. **Enable pgvector:** Contact Neon support or switch to Supabase
3. **Create Task List:** Break down into implementable tasks
4. **Install Dependencies:** Start with Phase 2
5. **Prototype:** Build minimal viable search (Phases 3, 6, 8)
6. **Iterate:** Add features incrementally

---

## Open Questions

1. **pgvector on Neon:** Is it available? Need upgrade?
2. **Model Storage:** Where to cache Xenova models? (CDN vs local)
3. **File Storage:** Replit Object Storage limit? Cost?
4. **OCR Language:** Support languages beyond English?
5. **Search UI:** Standalone page or embedded in equipment details?
6. **Admin Access:** Who can upload documents? Single super-admin?

---

**End of Integration Plan**

Ready to proceed with implementation?
