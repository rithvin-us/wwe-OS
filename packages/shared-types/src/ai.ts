/**
 * Mirrors `platform/ai/views.py::GenerateView` — the real platform AI
 * gateway (`POST /api/v1/ai/generate/`), not the broken/stub "Rithu"
 * chatbot on web (fabricated documents, hardcoded figures, an unregistered
 * prompt key). Mobile calls this endpoint directly with the
 * `operator-assistant` prompt registered in `platform/ai/prompts.py` this
 * session — real provider, real (or the platform's own honest Mock) answer.
 */

export interface GenerateRequest {
  prompt_key?: string;
  variables?: Record<string, string>;
  system?: string;
  user?: string;
}

export interface GenerateResult {
  text: string;
  model: string;
  provider: string;
  cached: boolean;
  usage_id: string;
}
