const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')

export class ApiError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface FastApiValidationDetail {
  msg?: string
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json()
    if (data && typeof data === 'object' && 'detail' in data) {
      const detail = (data as { detail: unknown }).detail
      if (typeof detail === 'string') return detail
      if (Array.isArray(detail)) {
        const messages = detail
          .map((item) => (item as FastApiValidationDetail)?.msg)
          .filter((msg): msg is string => Boolean(msg))
        if (messages.length > 0) return messages.join('; ')
      }
    }
  } catch {
    // response body wasn't JSON (or was empty) — fall through to status text
  }
  return response.statusText || `Request failed with status ${response.status}`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, init)
  } catch {
    throw new ApiError(
      `Could not reach the API at ${API_URL}. Is the backend running?`,
    )
  }

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status)
  }

  return response.json() as Promise<T>
}

// Financial values may come back as a string or a number — the backend's
// extraction model doesn't fully constrain the LLM's output type for these
// fields, so the same field can be a string for one company and a number
// for another. See frontend/src/lib/format.ts.
export interface CompanyMetric {
  id: string
  company: string
  year: string
  revenue: string | number | null
  net_income: string | number | null
  operating_income: string | number | null
  cash_flow: string | number | null
  total_assets: string | number | null
  total_liabilities: string | number | null
  risk_factors: string | null
  growth_drivers: string | null
  updated_at: string
}

export function fetchMetrics(): Promise<CompanyMetric[]> {
  return request<CompanyMetric[]>('/api/metrics')
}

export interface UploadResponse {
  message: string
  file_name: string
}

/**
 * Uploads via XHR (rather than fetch) so we can surface real byte-upload
 * progress for the multipart body. The backend's ingestion work (PDF
 * parsing + LLM extraction) happens after the body finishes uploading and
 * can take 30-90+ seconds with no further progress signal — callers should
 * treat "upload complete, still waiting" as a distinct state.
 */
export function uploadReport(
  file: File,
  onUploadProgress?: (fraction: number) => void,
): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}/api/upload`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onUploadProgress) {
        onUploadProgress(event.loaded / event.total)
      }
    }

    xhr.onload = () => {
      let body: unknown
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        body = undefined
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as UploadResponse)
        return
      }

      const detail =
        body && typeof body === 'object' && 'detail' in body
          ? (body as { detail: unknown }).detail
          : undefined
      const message =
        typeof detail === 'string'
          ? detail
          : xhr.statusText || `Upload failed with status ${xhr.status}`
      reject(new ApiError(message, xhr.status))
    }

    xhr.onerror = () => {
      reject(new ApiError(`Could not reach the API at ${API_URL}. Is the backend running?`))
    }

    xhr.send(formData)
  })
}

export interface ChatRequestBody {
  question: string
  company?: string | null
  year?: number | null
}

export interface ChatResponse {
  answer: string
}

export function askQuestion(body: ChatRequestBody): Promise<ChatResponse> {
  return request<ChatResponse>('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export { API_URL }
