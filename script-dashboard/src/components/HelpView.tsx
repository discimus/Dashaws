import { useCellsStore } from '../store/useCellsStore';

export function HelpView() {
  const { addCell } = useCellsStore();

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-8 text-sm leading-relaxed">
      <h1 className="text-2xl font-bold text-on-surface">Script Reference</h1>

      <Section title="Execution Model">
        <p>Each script runs inside an isolated sandbox using <Code>new Function(...)</Code> with <Code>"use strict"</Code>. Dangerous globals are shadowed with <Code>undefined</Code> to prevent escape. Scripts execute as async functions — you can <Code>await</Code> directly at the top level.</p>
                <p className="mt-2">Scripts can run on a configurable interval (set via the UI), or be triggered manually with the Run Once button. The scheduler uses the <Code>signal</Code> <span className="text-on-surface-variant">(AbortSignal)</span> to interrupt execution cleanly when a script is stopped.</p>
      </Section>

      <Section title="Sandbox Globals ($-prefixed)">
        <SubSection title="$state" type="object">
          Persists data <em>across</em> script runs. Survives page reloads and script restarts. Values are masked against secrets before being saved to storage.
          <Example>{`$state.counter = ($state.counter || 0) + 1;
console.log("Run count:", $state.counter);

// Store complex data
$state.lastPayload = { items: [1,2,3], ts: Date.now() };`}</Example>
        </SubSection>

        <SubSection title="$env" type="Record&lt;string, string&gt;">
          Environment variables configured in the <strong>Environment</strong> tab. All values are strings. Access via <Code>$env.KEY_NAME</Code>.
          <Example>{`const apiUrl = $env.API_URL || "https://default.example.com";
const res = await fetch(apiUrl);
console.log(res.status);`}</Example>
        </SubSection>

        <SubSection title="$secrets" type="Record&lt;string, string&gt;">
          Encrypted secrets from the <strong>Secrets</strong> tab. Stored with <Code>PBKDF2</Code> (200k iterations, SHA-256) + <Code>AES-GCM 256-bit</Code>. Values are <strong>automatically masked</strong> in console output to prevent accidental exfiltration.
          <Example>{`const data = await fetch("https://api.example.com", {
  headers: { Authorization: \`Bearer \${$secrets.API_KEY}\` }
});
// $secrets.API_KEY will appear as \u2022\u2022\u2022 in logs`}</Example>
        </SubSection>

        <SubSection title="$props" type="Record&lt;string, unknown&gt;">
          Parameters defined in the <strong>gear (⚙)</strong> icon of a script card. When a script is triggered by a queue message or pubsub event, the parsed message body is passed as <Code>$props</Code>.
          <Example>{`// Gear defines: { "endpoint": "users" }
// Queue message: { "dryRun": true }
// → $props = { endpoint: "users", dryRun: true }

console.log("Endpoint:", $props.endpoint);
if ($props.dryRun) console.log("Dry run mode");`}</Example>
        </SubSection>

        <SubSection title="$queue" type="{ enqueue }">
          FIFO message queues (like AWS SQS). Scripts subscribe to queues in the <strong>Queues</strong> tab. Enqueued messages are processed in order by all subscribers.
          <Example>{`// Enqueue a message from any script
$queue.enqueue("my-queue", JSON.stringify({
  task: "send-email",
  to: "user@example.com"
}));

// Queue subscribers receive: { name, body, timestamp }`}</Example>
        </SubSection>

        <SubSection title="$pubsub" type="{ emit }">
          Broadcast event topics (like AWS SNS). Emitting an event triggers <em>all</em> subscribed scripts immediately (not queued). Use for real-time notifications.
          <Example>{`// Emit an event from any script
$pubsub.emit("my-topic", JSON.stringify({
  event: "deploy",
  version: "v2.1.0"
}));

// All subscribers receive: { name, body, timestamp }`}</Example>
        </SubSection>
      </Section>

      <Section title="Python Scripts (server mode)">
        <p>When running the <strong>Python server</strong> (<Code>./start-server.sh python</Code>), scripts are written in Python with these globals and libraries available:</p>

        <SubSection title="print" type="builtin">
          Replaces the standard <Code>print()</Code> — output is captured and displayed per-script instead of going to the server console.
          <Example>{`print("Hello!")
print("Counter:", state["counter"])

# sep and end are supported
print("a", "b", "c", sep=", ")`}</Example>
        </SubSection>

        <SubSection title="console" type="Console API (alias)">
          Available as an alias for familiarity: <Code>console.log()</Code>, <Code>console.warn()</Code>, <Code>console.error()</Code>, <Code>console.info()</Code>, <Code>console.table()</Code>.
        </SubSection>

        <SubSection title="requests" type="HTTP client">
          Full <Code>requests</Code> module for HTTP calls. Use <Code>requests.get()</Code>, <Code>requests.post()</Code>, <Code>requests.put()</Code>, etc. Returns a Response object with <Code>.status_code</Code>, <Code>.text</Code>, <Code>.json()</Code>, <Code>.headers</Code>.
          <Example>{`# GET request
resp = requests.get("https://api.example.com/data")
print(resp.status_code)
data = resp.json()

# POST with JSON
resp = requests.post("https://api.example.com/items", json={"name": "test"})

# Authenticated request
resp = requests.get("https://api.example.com",
    headers={"Authorization": "Bearer " + secrets.get("API_KEY", "")})`}</Example>
        </SubSection>

        <SubSection title="Available libraries" type="import">
          <p>These libraries are installed and available via <Code>import</Code>. Each listed library comes from the Python standard library or is pre-installed in the server environment.</p>

          <h4 className="mt-3 mb-1 text-xs font-semibold text-warning">Web & HTTP</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-on-surface-variant">
            <div><Code>requests</Code> — HTTP client (get/post/put)</div>
            <div><Code>beautifulsoup4</Code> — HTML scraping and parsing</div>
            <div><Code>feedparser</Code> — RSS / Atom feed parsing</div>
            <div><Code>xmltodict</Code> — XML to dict conversion</div>
            <div><Code>lxml</Code> — fast XML / HTML parser</div>
            <div><Code>xml.etree</Code> — stdlib XML (ElementTree)</div>
          </div>

          <h4 className="mt-3 mb-1 text-xs font-semibold text-warning">Data & Documents</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-on-surface-variant">
            <div><Code>pandas</Code> — data analysis / DataFrames</div>
            <div><Code>numpy</Code> — numerical computing</div>
            <div><Code>openpyxl</Code> — Excel .xlsx read/write</div>
            <div><Code>pypdf</Code> — PDF text extraction</div>
            <div><Code>pyyaml</Code> — YAML config parsing</div>
            <div><Code>python-dotenv</Code> — .env file loading</div>
            <div><Code>json</Code>, <Code>csv</Code> — stdlib parsers</div>
            <div><Code>datetime</Code>, <Code>time</Code> — stdlib dates</div>
          </div>

          <h4 className="mt-3 mb-1 text-xs font-semibold text-warning">Databases</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-on-surface-variant">
            <div><Code>sqlalchemy</Code> — SQL ORM (unified API)</div>
            <div><Code>psycopg2</Code> — PostgreSQL adapter</div>
            <div><Code>pymssql</Code> — SQL Server adapter</div>
            <div><Code>pyodbc</Code> — ODBC (SQL Server, etc.)</div>
          </div>

          <h4 className="mt-3 mb-1 text-xs font-semibold text-warning">Charts</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-on-surface-variant">
            <div><Code>matplotlib</Code> — charts saved as PNG</div>
            <div><Code>pillow</Code> — image processing</div>
          </div>

          <p className="mt-3 text-on-surface-variant">Use standard <Code>import</Code> statements — any installed Python package is available.</p>
          <Example>{`import pandas as pd
import numpy as np
import sqlalchemy as sa
import matplotlib.pyplot as plt
from bs4 import BeautifulSoup
import yaml

# Read Excel
df = pd.read_excel("data.xlsx")
print(df.head())

# PostgreSQL with SQLAlchemy
engine = sa.create_engine("postgresql://user:pass@host/db")
with engine.connect() as conn:
    df = pd.read_sql("SELECT * FROM users LIMIT 10", conn)
print(df)

# SQL Server with pyodbc
engine = sa.create_engine("mssql+pyodbc://user:pass@host/db?driver=ODBC+Driver+17+for+SQL+Server")
df.to_sql("export", engine, if_exists="replace")

# RSS feed
import feedparser
feed = feedparser.parse("https://example.com/rss")
for entry in feed.entries:
    print(entry.title, entry.link)

# YAML config
config = yaml.safe_load(open("config.yml"))
print(config["settings"])

# Chart to PNG
plt.figure()
plt.plot([1, 2, 3], [4, 5, 6])
plt.savefig("/tmp/chart.png")`}</Example>
        </SubSection>

        <SubSection title="Sandbox globals" type="Python">
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div><Code>print(...)</Code> — captured output</div>
            <div><Code>console.log/warn/error/info/table</Code> — JS alias</div>
            <div><Code>requests</Code> — HTTP client module</div>
            <div><Code>state</Code> — dict, mutable, persisted</div>
            <div><Code>props</Code> — dict, from params/queue/pubsub</div>
            <div><Code>env</Code> — dict, environment variables</div>
            <div><Code>secrets</Code> — dict, encrypted secrets</div>
            <div><Code>queue.enqueue(name, body)</Code> — enqueue message</div>
            <div><Code>pubsub.emit(name, body)</Code> — emit event</div>
          </div>
        </SubSection>

        <SubSection title="Full example" type="Python">
          <Example>{`# Python script example
print("Hello!")

state["counter"] = state.get("counter", 0) + 1
print("Run count:", state["counter"])

# HTTP with requests
resp = requests.get("https://api.github.com/zen")
print("GitHub zen:", resp.text.strip())

# Environment variables
api_url = env.get("API_URL", "https://default.example.com")

# Secrets
token = secrets.get("API_KEY", "")
resp = requests.get(api_url,
    headers={"Authorization": "Bearer " + token})

# Enqueue a message
queue.enqueue("my-queue", {"task": "process", "id": 42})

# Emit an event
pubsub.emit("my-topic", {"event": "completed"})`}</Example>
        </SubSection>
      </Section>

      <Section title="Standard Globals">
        <SubSection title="console" type="Console API">
          <table className="mt-2 w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-outline-variant text-left">
                <th className="py-1.5 pr-4 text-on-surface-variant font-semibold w-20">Method</th>
                <th className="py-1.5 text-on-surface-variant font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="text-on-surface-variant">
              <tr className="border-b border-outline-variant/50">
                <td className="py-1.5 pr-4"><Code>log(...args)</Code></td>
                <td className="py-1.5">Standard output. Shows below the script editor.</td>
              </tr>
              <tr className="border-b border-outline-variant/50">
                <td className="py-1.5 pr-4"><Code>warn(...args)</Code></td>
                <td className="py-1.5">Warning output (yellow indicator).</td>
              </tr>
              <tr className="border-b border-outline-variant/50">
                <td className="py-1.5 pr-4"><Code>error(...args)</Code></td>
                <td className="py-1.5">Error output (red indicator).</td>
              </tr>
              <tr className="border-b border-outline-variant/50">
                <td className="py-1.5 pr-4"><Code>info(...args)</Code></td>
                <td className="py-1.5">Informational output (blue indicator).</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4"><Code>table(data)</Code></td>
                <td className="py-1.5">Tabular output for arrays of objects.</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-on-surface-variant">All console output is captured and displayed per-script. Arguments containing secret values are masked before display.</p>
        </SubSection>

        <SubSection title="fetch" type="Web Fetch API">
          Standard <Code>fetch()</Code> for HTTP requests. Returns a Response object. Works in both browser and server mode.
          <Example>{`const res = await fetch("https://api.github.com/zen");
const text = await res.text();

const json = await fetch("https://api.example.com/data")
  .then(r => r.json());`}</Example>
        </SubSection>

        <SubSection title="setTimeout / clearTimeout" type="Tracked timers">
          Timers created via <Code>setTimeout</Code> are <strong>tracked</strong> and automatically cleared when the script execution ends. No need to manually clean up.
          <Example>{`const id = setTimeout(() => {
  console.log("Runs after 2 seconds");
}, 2000);

// Cancel before it fires
clearTimeout(id);`}</Example>
        </SubSection>

        <SubSection title="loadPackage" type="CDN Package Loader">
          Loads npm packages at runtime from <Code>esm.sh</Code>. Fetches the package, creates a Blob URL, and dynamically imports it. Results are <strong>cached</strong> across all script executions.
          <p className="mt-2 text-on-surface-variant">Returns an ESM module namespace object. Use <Code>.default</Code> for the default export. Use <Code>?bundle</Code> internally to inline all dependencies.</p>
          <Example>{`// Default export (most packages)
const _ = (await loadPackage("lodash@4")).default;
console.log(_.chunk([1,2,3,4], 2)); // [[1,2],[3,4]]

// Named exports
const { v4 } = await loadPackage("uuid");
console.log(v4()); // "550e8400-e29b-41d4-a716-446655440000"

// Date formatting
const dayjs = (await loadPackage("dayjs")).default;
console.log(dayjs().format("DD/MM/YYYY HH:mm:ss"));`}</Example>
        </SubSection>

        <SubSection title="signal" type="AbortSignal">
          An <Code>AbortSignal</Code> that is aborted when the script is stopped or the execution times out. Use to gracefully clean up resources.
          <Example>{`// Clean up when script is stopped
signal.addEventListener("abort", () => {
  console.log("Script stopping — cleaning up...");
});

// Check if already aborted
if (signal.aborted) return;

// Pass to fetch for cancellation
const res = await fetch("https://example.com", { signal });`}</Example>
        </SubSection>
      </Section>

      <Section title="Built-in Objects">
        <p>All standard JavaScript built-ins are available (with constructor chains stripped for safety):</p>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1">
          {['Math', 'Date', 'JSON', 'Array', 'Object', 'String', 'Number', 'Boolean', 'RegExp', 'Map', 'Set', 'Promise', 'Error', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURI', 'decodeURI', 'btoa', 'atob'].map(name => (
            <span key={name} className="text-on-surface-variant"><Code>{name}</Code></span>
          ))}
        </div>
      </Section>

      <Section title="Security Model">
        <SubSection title="Blocked Globals" type="Never accessible">
          <p>These globals are shadowed with <Code>undefined</Code> in every sandbox execution to prevent escape:</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {['window', 'document', 'Function', 'eval', 'require', 'process', 'setInterval', 'clearInterval', 'globalThis'].map(name => (
              <span key={name} className="px-2 py-1 rounded-full bg-error-container/40 text-on-error-container text-xs font-mono border border-error/40">{name}</span>
            ))}
          </div>
        </SubSection>

        <SubSection title="Constructor Stripping" type="Anti-escape">
          <p>To prevent sandbox escape via the constructor chain (<Code>[].constructor.constructor → Function</Code>), all safe constructors have their <Code>.constructor</Code> property set to <Code>undefined</Code>:</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {['Array', 'Object', 'String', 'Number', 'Boolean', 'RegExp', 'Map', 'Set', 'Promise', 'Error', 'Date'].map(name => (
              <span key={name} className="px-2 py-1 rounded-full bg-warning-container/40 text-on-warning-container text-xs font-mono border border-warning/40">{name}</span>
            ))}
          </div>
          <p className="mt-2 text-on-surface-variant">Applied in <strong>both</strong> browser and server sandboxes. Effective against <Code>{`([]).constructor.constructor("return process")`}</Code> and similar escape vectors.</p>
        </SubSection>

        <SubSection title="Secret Masking" type="Output protection">
          <p>Secret values from <Code>$secrets</Code> are replaced with bullet characters (<Code>{'\u2022'}</Code>) in all console output and in the <Code>$state</Code> that gets persisted. This prevents accidental exfiltration through logs, state snapshots, or the UI.</p>
          <p className="mt-1 text-on-surface-variant">Masking is applied <em>recursively</em> — it traverses object keys and values, arrays, and nested structures.</p>
        </SubSection>
      </Section>

      <Section title="Key Bindings">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-outline-variant text-left">
              <th className="py-1.5 pr-4 text-on-surface-variant font-semibold w-40">Shortcut</th>
              <th className="py-1.5 text-on-surface-variant font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="text-on-surface-variant">
            <tr className="border-b border-outline-variant/50">
              <td className="py-1.5 pr-4"><Code>Ctrl/Cmd + Enter</Code></td>
              <td className="py-1.5">Run script once</td>
            </tr>
            <tr className="border-b border-outline-variant/50">
              <td className="py-1.5 pr-4"><Code>Ctrl/Cmd + Shift + F</Code></td>
              <td className="py-1.5">Format JSON in props editor</td>
            </tr>
            <tr className="border-b border-outline-variant/50">
              <td className="py-1.5 pr-4"><Code>Ctrl/Cmd + /</Code></td>
              <td className="py-1.5">Toggle comment in script editor</td>
            </tr>
            <tr className="border-b border-outline-variant/50">
              <td className="py-1.5 pr-4"><Code>Ctrl/Cmd + S</Code></td>
              <td className="py-1.5">Save script (autosaved on blur as well)</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Quick Start">
        <p>Create your first script to get started:</p>
        <button
          onClick={addCell}
          className="md-btn md-btn-filled mt-3 px-4 py-2 text-base"
        >
          + Add Script
        </button>
      </Section>

      <div className="pb-12" />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-on-surface pb-3 mb-3 border-b border-outline-variant">{title}</h2>
      <div className="text-on-surface-variant">{children}</div>
    </section>
  );
}

function SubSection({ title, type, children }: { title: string; type: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0 pl-4 border-l-2 border-outline-variant">
      <h3 className="text-sm font-semibold text-primary">
        {title} <span className="text-on-surface-variant font-normal ml-1">{type}</span>
      </h3>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Example({ children }: { children: string }) {
  return (
    <pre className="mt-2 p-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-xs text-on-surface-variant overflow-x-auto">{children}</pre>
  );
}

function Code({ children }: { children: string }) {
  return <code className="md-code text-primary text-xs">{children}</code>;
}
