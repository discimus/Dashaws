import { useCellsStore } from '../store/useCellsStore';

export function HelpView() {
  const { addCell } = useCellsStore();

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-8 text-sm leading-relaxed">
      <h1 className="text-2xl font-bold text-white">Script Reference</h1>

      <Section title="Execution Model">
        <p>Each script runs inside an isolated sandbox using <Code>new Function(...)</Code> with <Code>"use strict"</Code>. Dangerous globals are shadowed with <Code>undefined</Code> to prevent escape. Scripts execute as async functions — you can <Code>await</Code> directly at the top level.</p>
        <p className="mt-2">Scripts can run on a configurable interval (set via the UI), or be triggered manually with the Run Once button. The scheduler uses the <Code>signal</Code> <span className="text-gray-400">(AbortSignal)</span> to interrupt execution cleanly when a script is stopped.</p>
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

      <Section title="Standard Globals">
        <SubSection title="console" type="Console API">
          <table className="mt-2 w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-700 text-left">
                <th className="py-1.5 pr-4 text-gray-400 font-semibold w-20">Method</th>
                <th className="py-1.5 text-gray-400 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-gray-800">
                <td className="py-1.5 pr-4"><Code>log(...args)</Code></td>
                <td className="py-1.5">Standard output. Shows below the script editor.</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-1.5 pr-4"><Code>warn(...args)</Code></td>
                <td className="py-1.5">Warning output (yellow indicator).</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-1.5 pr-4"><Code>error(...args)</Code></td>
                <td className="py-1.5">Error output (red indicator).</td>
              </tr>
              <tr className="border-b border-gray-800">
                <td className="py-1.5 pr-4"><Code>info(...args)</Code></td>
                <td className="py-1.5">Informational output (blue indicator).</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4"><Code>table(data)</Code></td>
                <td className="py-1.5">Tabular output for arrays of objects.</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-gray-400">All console output is captured and displayed per-script. Arguments containing secret values are masked before display.</p>
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
          <p className="mt-2 text-gray-400">Returns an ESM module namespace object. Use <Code>.default</Code> for the default export. Use <Code>?bundle</Code> internally to inline all dependencies.</p>
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
            <span key={name} className="text-gray-300"><Code>{name}</Code></span>
          ))}
        </div>
      </Section>

      <Section title="Security Model">
        <SubSection title="Blocked Globals" type="Never accessible">
          <p>These globals are shadowed with <Code>undefined</Code> in every sandbox execution to prevent escape:</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {['window', 'document', 'Function', 'eval', 'require', 'process', 'setInterval', 'clearInterval', 'globalThis'].map(name => (
              <span key={name} className="px-2 py-1 rounded bg-red-900/40 text-red-300 text-xs font-mono border border-red-800/50">{name}</span>
            ))}
          </div>
        </SubSection>

        <SubSection title="Constructor Stripping" type="Anti-escape">
          <p>To prevent sandbox escape via the constructor chain (<Code>[].constructor.constructor → Function</Code>), all safe constructors have their <Code>.constructor</Code> property set to <Code>undefined</Code>:</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {['Array', 'Object', 'String', 'Number', 'Boolean', 'RegExp', 'Map', 'Set', 'Promise', 'Error', 'Date'].map(name => (
              <span key={name} className="px-2 py-1 rounded bg-yellow-900/30 text-yellow-300 text-xs font-mono border border-yellow-800/40">{name}</span>
            ))}
          </div>
          <p className="mt-2 text-gray-400">Applied in <strong>both</strong> browser and server sandboxes. Effective against <Code>{`([]).constructor.constructor("return process")`}</Code> and similar escape vectors.</p>
        </SubSection>

        <SubSection title="Secret Masking" type="Output protection">
          <p>Secret values from <Code>$secrets</Code> are replaced with bullet characters (<Code>{'\u2022'}</Code>) in all console output and in the <Code>$state</Code> that gets persisted. This prevents accidental exfiltration through logs, state snapshots, or the UI.</p>
          <p className="mt-1 text-gray-400">Masking is applied <em>recursively</em> — it traverses object keys and values, arrays, and nested structures.</p>
        </SubSection>
      </Section>

      <Section title="Key Bindings">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-700 text-left">
              <th className="py-1.5 pr-4 text-gray-400 font-semibold w-40">Shortcut</th>
              <th className="py-1.5 text-gray-400 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-gray-800">
              <td className="py-1.5 pr-4"><Code>Ctrl/Cmd + Enter</Code></td>
              <td className="py-1.5">Run script once</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-1.5 pr-4"><Code>Ctrl/Cmd + Shift + F</Code></td>
              <td className="py-1.5">Format JSON in props editor</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-1.5 pr-4"><Code>Ctrl/Cmd + /</Code></td>
              <td className="py-1.5">Toggle comment in script editor</td>
            </tr>
            <tr className="border-b border-gray-800">
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
          className="mt-3 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors"
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
      <h2 className="text-lg font-semibold text-white pb-3 mb-3 border-b border-gray-700">{title}</h2>
      <div className="text-gray-300">{children}</div>
    </section>
  );
}

function SubSection({ title, type, children }: { title: string; type: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0 pl-4 border-l-2 border-gray-700">
      <h3 className="text-sm font-semibold text-blue-300">
        {title} <span className="text-gray-500 font-normal ml-1">{type}</span>
      </h3>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Example({ children }: { children: string }) {
  return (
    <pre className="mt-2 p-3 rounded bg-gray-950 border border-gray-700 text-xs text-gray-300 overflow-x-auto">{children}</pre>
  );
}

function Code({ children }: { children: string }) {
  return <code className="px-1 py-0.5 rounded bg-gray-700 text-blue-200 text-xs font-mono">{children}</code>;
}
