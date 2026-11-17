<script setup>
import { computed, onMounted, ref } from 'vue'
import { buildMockRequestUrl, executeMockRequest, loadMockEndpoints } from './services/accountDetails'

const endpoints = ref([])
const requestValues = ref({})
const response = ref(null)
const responseError = ref('')
const activeRequest = ref('')
const lastRequestUrl = ref('')
const history = ref([])

const formattedResponse = computed(() => {
  if (!response.value) return ''
  return JSON.stringify(response.value, null, 2)
})

onMounted(async () => {
  try {
    endpoints.value = await loadMockEndpoints()
    requestValues.value = Object.fromEntries(
      endpoints.value.map((endpoint) => [
        endpoint.id,
        Object.fromEntries(
          endpoint.parameters.map((parameter) => [parameter.name, parameter.defaultValue ?? '']),
        ),
      ]),
    )
  } catch (error) {
    responseError.value = error instanceof Error ? error.message : 'Unable to load mock endpoints.'
  }
})

function recordHistory(endpoint, parameterSummary, requestUrl, status) {
  history.value.unshift({
    id: `${Date.now()}-${Math.random()}`,
    action: endpoint.label,
    parameter: parameterSummary,
    requestUrl,
    status,
    time: new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date()),
  })
  history.value = history.value.slice(0, 8)
}

function normalizeParameter(action, parameter) {
  if (!parameter.digitsOnly) return

  const value = requestValues.value[action.id][parameter.name] ?? ''
  requestValues.value[action.id][parameter.name] = String(value)
    .replace(/\D/g, '')
    .slice(0, parameter.maxLength ?? Infinity)
}

async function runAction(action) {
  const values = requestValues.value[action.id] ?? {}
  const parameters = Object.fromEntries(
    action.parameters.map((parameter) => [
      parameter.name,
      String(values[parameter.name] ?? '').trim(),
    ]),
  )
  const missingParameter = action.parameters.find(
    (parameter) => parameter.required && !parameters[parameter.name],
  )

  if (missingParameter) {
    response.value = null
    responseError.value = `Enter ${missingParameter.label.toLowerCase()} to continue.`
    return
  }

  const invalidParameter = action.parameters.find((parameter) => {
    const value = parameters[parameter.name]
    return (
      (parameter.digitsOnly && !/^\d+$/.test(value)) ||
      (parameter.minLength != null && value.length < parameter.minLength) ||
      (parameter.maxLength != null && value.length > parameter.maxLength)
    )
  })

  if (invalidParameter) {
    response.value = null
    responseError.value =
      invalidParameter.digitsOnly && invalidParameter.minLength === invalidParameter.maxLength
        ? `Enter ${invalidParameter.label.toLowerCase()} using exactly ${invalidParameter.minLength} digits.`
        : `Enter ${invalidParameter.label.toLowerCase()} using digits within the allowed length.`
    return
  }

  activeRequest.value = action.id
  responseError.value = ''
  const requestUrl = buildMockRequestUrl(action, parameters)
  const parameterSummary = Object.entries(parameters)
    .map(([key, value]) => `${key}=${value || '(empty)'}`)
    .join(' · ')

  try {
    response.value = await executeMockRequest(action, parameters)
    lastRequestUrl.value = requestUrl
    recordHistory(action, parameterSummary, requestUrl, 'Successful')
  } catch (error) {
    response.value = null
    responseError.value = error instanceof Error ? error.message : 'The request could not be completed.'
    recordHistory(action, parameterSummary, requestUrl, 'Unavailable')
  } finally {
    activeRequest.value = ''
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="Data Viewer home">
        <span class="brand-mark" aria-hidden="true">
          <span></span><span></span></span>
        <span class="brand-copy">
          <span class="brand-name">Data Viewer</span>
          <span class="brand-caption"> BANKING CONSOLE</span>
        </span>
      </a>
      <div class="topbar-meta">
        <span class="environment"><span class="environment-dot"></span> MOCK ENVIRONMENT</span>
        <span class="avatar" aria-label="User">DV</span>
      </div>
    </header>

    <main class="main-content">
      <section class="page-heading">
        <div>
          <p class="eyebrow">CUSTOMER SERVICES <span>/</span> DATA LOOKUP</p>
          <h1>Account data viewer</h1>
          <p class="page-description">Look up customer and account information from the  banking API.</p>
        </div>
        <div class="connection-status"><span></span> Service ready</div>
      </section>

      <section class="workspace-card">
        <div class="section-heading">
          <div>
            <div class="section-title-row">
              <span class="section-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M4 7.5h16M4 12h16M4 16.5h10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="18" cy="16.5" r="2.5" stroke="currentColor" stroke-width="1.7"/></svg>
              </span>
              <h2>Request workspace</h2>
            </div>
            <p>Choose an operation and provide the required lookup value.</p>
          </div>
          <div class="base-url"><span class="base-url-label">REQUEST CONFIG</span><code>mock-endpoints.json</code></div>
        </div>

        <div class="action-grid">
          <div v-for="action in endpoints" :key="action.id" class="action-item">
            <div class="endpoint-heading">
              <label :for="`${action.id}-${action.parameters[0].name}`">{{ action.label }}</label>
              <code>{{ action.method }} {{ action.path }}</code>
            </div>
            <div v-for="parameter in action.parameters" :key="parameter.name" class="input-row parameter-row">
              <label class="visually-hidden" :for="`${action.id}-${parameter.name}`">{{ parameter.label }}</label>
              <select
                v-if="parameter.type === 'select'"
                :id="`${action.id}-${parameter.name}`"
                v-model="requestValues[action.id][parameter.name]"
                :aria-label="parameter.label"
              >
                <option v-for="option in parameter.options" :key="option" :value="option">{{ option }}</option>
              </select>
              <input
                v-else
                :id="`${action.id}-${parameter.name}`"
                v-model="requestValues[action.id][parameter.name]"
                :type="parameter.type || 'text'"
                :placeholder="parameter.placeholder"
                :aria-label="parameter.label"
                :inputmode="parameter.digitsOnly ? 'numeric' : undefined"
                :pattern="parameter.digitsOnly ? '[0-9]*' : undefined"
                :maxlength="parameter.maxLength"
                @input="normalizeParameter(action, parameter)"
                @keydown.enter="runAction(action)"
              />
              <button
                v-if="parameter === action.parameters[action.parameters.length - 1]"
                class="action-button"
                type="button"
                :disabled="activeRequest === action.id"
                @click="runAction(action)"
              >
                <span v-if="activeRequest === action.id" class="button-spinner"></span>
                <span v-else>{{ action.method === 'GET' ? 'Fetch' : 'Send' }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="output-grid" aria-label="Request results">
        <article class="output-card response-card">
          <div class="output-heading">
            <div>
              <h2>Response</h2>
              <p>{{ lastRequestUrl || 'Latest endpoint result' }}</p>
            </div>
            <span v-if="response" class="response-code"><span></span> 200 OK</span>
          </div>
          <div v-if="response" class="response-body">
            <div class="code-toolbar"><span>application/json</span><span>Pretty</span></div>
            <pre><code>{{ formattedResponse }}</code></pre>
          </div>
          <div v-else-if="responseError" class="empty-state error-state">
            <span class="state-icon error-icon">!</span>
            <p>{{ responseError }}</p>
          </div>
          <div v-else class="empty-state">
            <span class="state-icon">
              <svg viewBox="0 0 24 24" fill="none"><path d="M7 3.75h7l4 4v12.5H7a2 2 0 0 1-2-2v-12.5a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.5"/><path d="M14 4v4h4M8.5 13h7M8.5 16h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </span>
            <p>Your response will appear here</p>
            <span>Run an endpoint to inspect its JSON result.</span>
          </div>
        </article>
 
        <article class="output-card history-card">
          <div class="output-heading">
            <div>
              <h2>Request history</h2>
              <p>Your recent lookups in this session</p>
            </div>
            <span class="history-count">{{ history.length }} / 8</span>
          </div>
          <div v-if="history.length" class="history-list">
            <div v-for="item in history" :key="item.id" class="history-item">
              <span class="history-indicator" :class="{ unavailable: item.status !== 'Successful' }"></span>
              <div class="history-details">
                <strong>{{ item.action }}</strong>
                <code>{{ item.parameter }}</code>
              </div>
              <div class="history-meta">
                <span :class="{ 'status-unavailable': item.status !== 'Successful' }">{{ item.status }}</span>
                <time>{{ item.time }}</time>
              </div>
            </div>
          </div>
          <div v-else class="empty-state history-empty">
            <span class="state-icon history-state-icon">
              <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.5"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
            <p>No requests yet</p>
            <span>Requests you make will be listed here.</span>
          </div>
        </article>
      </section>

      <footer class="page-footer">
        <span>Data Viewer <span class="footer-separator">·</span> Development workspace</span>
        <span>Mock data <span class="footer-dot"></span> Ready for integration</span>
      </footer>
    </main>
  </div>
</template>

<style>
:root {
  font-family: 'DM Sans', 'Segoe UI', sans-serif;
  color: #1e293b;
  background: #f4f7fa;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-optical-sizing: auto;
  font-weight: 400;
  --navy: #152c47;
  --blue: #3975bd;
  --muted: #76869a;
  --border: #e3eaf1;
}

* {
  box-sizing: border-box;
}

body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
  background:
    radial-gradient(ellipse at 80% 0%, rgba(215, 229, 244, 0.42), transparent 36rem),
    #f4f7fa;
}

button,
input,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

.app-shell {
  min-height: 100vh;
}

.topbar {
  height: 76px;
  padding: 0 max(36px, calc((100% - 1192px) / 2));
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.94);
  border-bottom: 1px solid #e8edf2;
}

.brand,
.topbar-meta,
.section-title-row,
.connection-status,
.environment,
.input-row,
.output-heading,
.history-item,
.history-meta,
.page-footer {
  display: flex;
  align-items: center;
}

.brand {
  gap: 12px;
  color: inherit;
  text-decoration: none;
}

.brand-mark {
  width: 38px;
  height: 38px;
  padding: 8px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  border-radius: 11px;
  background: #1c3c5d;
  transform: rotate(-4deg);
}

.brand-mark span {
  display: block;
  border-radius: 2px;
  background: #fff;
}

.brand-mark span:nth-child(2),
.brand-mark span:nth-child(3) {
  opacity: 0.58;
}

.brand-copy {
  display: grid;
  gap: 2px;
}

.brand-name {
  color: #213750;
  font-family: 'Manrope', 'Segoe UI', sans-serif;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.3px;
}

.brand-caption,
.eyebrow,
.base-url-label {
  color: #8a98a9;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.05px;
}

.topbar-meta {
  gap: 20px;
}

.environment {
  gap: 7px;
  padding: 7px 10px;
  color: #63758b;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.75px;
  background: #f4f7fa;
  border: 1px solid #e9eef3;
  border-radius: 5px;
}

.environment-dot,
.connection-status span,
.response-code span,
.footer-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #3cac84;
}

.avatar {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  color: #41658a;
  font-size: 11px;
  font-weight: 700;
  background: #e8f0f8;
  border-radius: 50%;
}

.main-content {
  width: min(1192px, calc(100% - 72px));
  margin: 0 auto;
  padding: 43px 0 26px;
}

.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 25px;
}

.eyebrow {
  margin: 0 0 9px;
}

.eyebrow span {
  margin: 0 5px;
  color: #bdc7d1;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 7px;
  color: #1c3048;
  font-family: 'Manrope', 'Segoe UI', sans-serif;
  font-size: clamp(25px, 3vw, 31px);
  font-weight: 700;
  letter-spacing: -1.1px;
}

.page-description {
  margin: 0;
  color: #76869a;
  font-size: 13px;
}

.connection-status {
  gap: 8px;
  padding-bottom: 3px;
  color: #60758c;
  font-size: 11px;
  font-weight: 600;
}

.workspace-card,
.output-card {
  background: #fff;
  border: 1px solid #e5ebf1;
  border-radius: 10px;
  box-shadow: 0 5px 16px rgba(34, 58, 82, 0.035);
}

.workspace-card {
  padding: 22px 24px 25px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22px;
}

.section-title-row {
  gap: 10px;
  margin-bottom: 6px;
}

.section-icon {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  color: #467db8;
  background: #edf4fb;
  border-radius: 7px;
}

.section-icon svg {
  width: 17px;
  height: 17px;
}

.section-heading h2,
.output-heading h2 {
  margin: 0;
  color: #263b53;
  font-family: 'Manrope', 'Segoe UI', sans-serif;
  font-size: 14px;
  font-weight: 700;
}

.section-heading p,
.output-heading p {
  margin: 0;
  color: #8492a2;
  font-size: 11px;
}

.base-url {
  display: grid;
  justify-items: end;
  gap: 5px;
}

.base-url code {
  max-width: 190px;
  overflow: hidden;
  padding: 5px 8px;
  color: #546a81;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #f5f7f9;
  border: 1px solid #e9edf1;
  border-radius: 4px;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 28px;
  row-gap: 15px;
}

.action-item {
  min-width: 0;
}

.action-item label {
  display: block;
  margin-bottom: 6px;
  color: #53667c;
  font-size: 10px;
  font-weight: 600;
}

.endpoint-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.endpoint-heading code {
  overflow: hidden;
  color: #8a99a9;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.parameter-row {
  margin-bottom: 6px;
}

.parameter-row:last-child {
  margin-bottom: 0;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.input-row {
  gap: 8px;
}

.input-row input,
.input-row select {
  min-width: 0;
  height: 36px;
  padding: 0 11px;
  color: #33475d;
  background: #fbfcfd;
  border: 1px solid #e1e8ef;
  border-radius: 5px;
  outline: none;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.input-row input {
  flex: 1;
  width: 0;
  font-size: 11px;
}

.input-row input::placeholder {
  color: #a9b4c0;
}

.input-row input:focus,
.input-row select:focus {
  border-color: #72a2d2;
  box-shadow: 0 0 0 3px rgba(74, 132, 191, 0.12);
}

.input-row select {
  width: 69px;
  padding: 0 8px;
  color: #435c76;
  font-size: 10px;
}

.action-button {
  min-width: 65px;
  height: 36px;
  padding: 0 13px;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  background: #3979bd;
  border: 1px solid #3979bd;
  border-radius: 5px;
  box-shadow: 0 2px 4px rgba(40, 99, 156, 0.12);
  transition: background 150ms ease, transform 150ms ease, box-shadow 150ms ease;
}

.action-button:hover:not(:disabled) {
  background: #2c68a8;
  box-shadow: 0 4px 8px rgba(40, 99, 156, 0.2);
  transform: translateY(-1px);
}

.action-button:disabled {
  cursor: wait;
  opacity: 0.75;
}

.button-spinner {
  width: 12px;
  height: 12px;
  display: inline-block;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 700ms linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.output-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.17fr) minmax(0, 0.83fr);
  gap: 18px;
  margin-top: 20px;
}

.output-card {
  min-height: 310px;
  overflow: hidden;
}

.output-heading {
  min-height: 67px;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #edf1f5;
}

.output-heading h2 {
  margin-bottom: 4px;
}

.output-heading p {
  font-size: 10px;
}

.response-code,
.history-count {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  color: #348567;
  font-size: 9px;
  font-weight: 700;
  background: #edf8f3;
  border-radius: 4px;
}

.response-code span {
  width: 6px;
  height: 6px;
}

.history-count {
  color: #718298;
  background: #f2f5f8;
}

.response-body {
  padding: 14px 17px 18px;
}

.code-toolbar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 9px;
  color: #97a4b2;
  font-size: 9px;
}

.code-toolbar span:last-child {
  color: #5b7da0;
}

.response-body pre {
  max-height: 290px;
  margin: 0;
  padding: 15px;
  overflow: auto;
  color: #476b5e;
  background: #f6faf8;
  border: 1px solid #e8f0ec;
  border-radius: 6px;
  font: 10px/1.7 'Cascadia Code', 'SFMono-Regular', Consolas, monospace;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.empty-state {
  min-height: 242px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
}

.state-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  margin-bottom: 10px;
  color: #7992ab;
  background: #f1f5f8;
  border-radius: 9px;
}

.state-icon svg {
  width: 19px;
  height: 19px;
}

.empty-state p {
  margin: 0 0 4px;
  color: #52667c;
  font-size: 11px;
  font-weight: 600;
}

.empty-state > span:last-child {
  color: #98a5b3;
  font-size: 10px;
}

.error-state .error-icon {
  color: #b75858;
  background: #fff1f0;
  font-weight: 700;
}

.error-state p {
  max-width: 300px;
  color: #a24f4f;
  line-height: 1.6;
}

.history-list {
  padding: 3px 17px;
}

.history-item {
  gap: 10px;
  min-height: 58px;
  border-bottom: 1px solid #eff2f5;
}

.history-item:last-child {
  border-bottom: 0;
}

.history-indicator {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #39a77d;
}

.history-indicator.unavailable {
  background: #d49a4e;
}

.history-details {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 3px;
}

.history-details strong {
  overflow: hidden;
  color: #4b6076;
  font-size: 10px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-details code {
  overflow: hidden;
  color: #8c9aaa;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-meta {
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.history-meta span {
  color: #3f9878;
  font-size: 8px;
  font-weight: 700;
}

.history-meta span.status-unavailable {
  color: #b28242;
}

.history-meta time {
  color: #9aa6b3;
  font-size: 9px;
}

.history-empty {
  min-height: 242px;
}

.history-state-icon {
  color: #8297ac;
}

.page-footer {
  justify-content: space-between;
  padding: 20px 2px 0;
  color: #94a1af;
  font-size: 9px;
}

.footer-separator {
  margin: 0 4px;
  color: #c4cdd6;
}

.footer-dot {
  width: 5px;
  height: 5px;
  display: inline-block;
  margin: 0 3px;
}


@media (max-width: 1024px) {
  .topbar { padding: 0 28px; }
  .main-content { width: calc(100% - 56px); }
  .output-grid { grid-template-columns: 1fr; }
  .output-card { min-height: 0; }
  .empty-state,
  .history-empty { min-height: 200px; }
}


@media (max-width: 740px) {
  .topbar { height: 66px; padding: 0 20px; }
  .main-content { width: calc(100% - 40px); padding-top: 32px; }
  .page-heading,
  .section-heading {
    align-items: flex-start;
    gap: 12px;
    flex-direction: column;
  }
  .base-url { justify-items: start; }
  .base-url code { max-width: 100%; }
  .action-grid { grid-template-columns: 1fr; row-gap: 18px; }
  .endpoint-heading { flex-wrap: wrap; }
}

/* Large phones  */
@media (max-width: 600px) {
  .main-content { width: calc(100% - 32px); }
  .workspace-card { padding: 20px 16px 22px; }
}

/* Standard phones */
@media (max-width: 520px) {
  .topbar { padding: 0 15px; }
  .brand-caption { font-size: 8px; }
  .topbar-meta { gap: 10px; }
  .environment { padding: 6px 7px; font-size: 8px; }
  .main-content { width: calc(100% - 30px); padding-top: 27px; }
  .workspace-card { padding: 18px 15px 20px; }
  .section-heading p { max-width: 100%; line-height: 1.5; }

  /* 16px text stops iOS zoom-on-focus; 44px = tap target */
  .input-row { flex-wrap: wrap; }
  .input-row input,
  .input-row select { height: 44px; font-size: 16px; }
  .input-row select { width: 100%; }
  .input-row input { flex: 1 1 140px; width: auto; }
  .action-button { height: 44px; min-width: 84px; font-size: 12px; }

  .action-item label,
  .endpoint-heading code { font-size: 11px; }

  .output-heading { gap: 10px; padding: 14px; }
  .output-heading > div { min-width: 0; }
  .output-heading p { overflow-wrap: anywhere; }
  .response-body { padding: 12px; }
  .response-body pre { max-height: 240px; padding: 12px; font-size: 11px; }

  .history-list { padding: 3px 14px; }
  .history-item { padding: 8px 0; }
  .history-details strong { font-size: 11px; }
  .history-details code { font-size: 10px; }
  .history-meta span { font-size: 9px; }

  .page-footer {
    align-items: flex-start;
    gap: 8px;
    flex-direction: column;
  }
}

/* Compact phones (iPhone SE/mini, Galaxy A, Pixel small) */
@media (max-width: 400px) {
  .brand { gap: 9px; }
  .brand-mark { width: 34px; height: 34px; padding: 7px; }
  .brand-name { font-size: 14px; }
  .main-content { width: calc(100% - 24px); }
  .workspace-card { padding: 16px 12px 18px; }
  .endpoint-heading { flex-direction: column; align-items: flex-start; gap: 3px; }
  .endpoint-heading code { white-space: normal; overflow-wrap: anywhere; }
  .response-code { padding: 4px 6px; }
  .history-item { gap: 8px; }
}

/* Very small phones (older Androids, 320px) */
@media (max-width: 360px) {
  .environment { display: none; }
  .brand-caption { display: none; }
  .avatar { width: 30px; height: 30px; }
  .action-button { flex: 1 1 100%; }  
  .history-count { display: none; }
}

/* Foldables (folded) and ultra-narrow screens */
@media (max-width: 300px) {
  .main-content { width: calc(100% - 16px); }
  .workspace-card { padding: 14px 10px; }
  .page-description,
  .section-heading p { font-size: 12px; }
  .history-item { flex-wrap: wrap; }
  .history-meta { flex-direction: row; gap: 8px; align-items: center; }
}

/* Phones in landscape (short screens) */
@media (max-height: 500px) and (orientation: landscape) {
  .topbar { height: 56px; }
  .main-content { padding-top: 18px; }
  .page-heading { margin-bottom: 16px; }
  .empty-state,
  .history-empty { min-height: 140px; }
  .response-body pre { max-height: 180px; }
}

/* Touch screens: no sticky hover effects, bigger tap targets */
@media (hover: none) {
  .action-button:hover:not(:disabled) {
    background: #3979bd;
    box-shadow: 0 2px 4px rgba(40, 99, 156, 0.12);
    transform: none;
  }
  .action-button:active:not(:disabled) {
    background: #2c68a8;
    transform: scale(0.97);
  }
}

@media (pointer: coarse) {
  .input-row input,
  .input-row select,
  .action-button { min-height: 44px; }
}


@supports (padding: max(0px)) {
  .topbar {
    padding-left: max(15px, env(safe-area-inset-left));
    padding-right: max(15px, env(safe-area-inset-right));
  }
  .main-content {
    padding-bottom: max(26px, env(safe-area-inset-bottom));
  }
}
</style>