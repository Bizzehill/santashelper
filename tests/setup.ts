import { TextEncoder, TextDecoder } from 'util'
import '@testing-library/jest-dom'

// jsdom doesn't provide these; @firebase/rules-unit-testing (via undici) needs them.
if (typeof globalThis.TextEncoder === 'undefined') {
  ;(globalThis as unknown as { TextEncoder: typeof TextEncoder }).TextEncoder = TextEncoder
}
if (typeof globalThis.TextDecoder === 'undefined') {
  ;(globalThis as unknown as { TextDecoder: typeof TextDecoder }).TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder
}

// Silences "not configured to support act(...)" warnings from tests that
// render directly via react-dom/client instead of @testing-library/react.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
