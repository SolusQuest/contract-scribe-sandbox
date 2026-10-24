#!/usr/bin/env python3
"""Incoming-only, fixed synthetic port of CreateSharedResponse. No model service."""
import argparse
import json
import os
import signal
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

MAX_BODY = 33554432  # Current DocumentationScribeBoundary logical request bound.
MAX_CALLS = 8        # Includes physical retry requests.
MODEL = "fixed-synthetic-noop"


def require(value):
    if not value:
        raise ValueError("Synthetic protocol rejected")


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def response(wire):
    """Same dynamic nonce/evidence/tool binding, fixed documentation decision."""
    require(wire["model"] == MODEL)
    messages = wire["messages"]
    require(isinstance(messages, list) and 5 <= len(messages) <= 256)
    policy = json.loads(messages[3]["content"])
    facts = json.loads(messages[4]["content"])
    nonce = policy["artifactSha256"]
    require(isinstance(nonce, str) and len(nonce) == 64
            and all(c in "0123456789abcdef" for c in nonce))
    ids = facts["executableTargetIds"]
    require(isinstance(ids, list) and len(ids) <= 5 and len(set(ids)) == len(ids))
    done = {r["targetId"] for r in facts["progress"]} | set(facts["restoredClosedTargetIds"])
    manifest = facts["manifest"]
    require(len(manifest) <= 64 and len({m["targetId"] for m in manifest}) == len(manifest))
    members = {m["targetId"]: m for m in manifest}
    pending = [members[i] for i in ids if i not in done][:8]
    references = list(facts["evidenceReferences"])
    for message in messages:
        if message["role"] == "tool":
            references.extend(json.loads(message["content"]).get("evidenceReferences", []))

    def evidence(member):
        return next((r for r in references
                     if r["subject"].get("symbolRef") == member["symbolRef"]), None)

    missing = [m for m in pending if not m["applicableComponents"] and evidence(m) is None]
    finish = not pending
    if missing:
        tools = [t["function"] for t in wire["tools"]
                 if "startLine" in t["function"]["parameters"].get("properties", {})]
        require(len(tools) == 1)
        calls = [{"id": "call.read." + str(len(messages)) + "." + str(i),
                  "type": "function", "function": {"name": tools[0]["name"],
                  "arguments": compact({"scopeId": m["sourceScopeId"]})}}
                 for i, m in enumerate(missing)]
        reasoning = "synthetic-shared-repository-read"
    else:
        terminal = {"kind": "finish" if finish else "submit", "scribeRequestSha256": nonce}
        if not finish:
            require(type(facts["nextSequence"]) is int and facts["nextSequence"] >= 1)
            items = []
            for member in pending:
                if member["applicableComponents"]:
                    result = {"kind": "skip", "reason": "scribe.skip.insufficient-evidence",
                              "evidenceReferenceIds": []}
                else:
                    ref = evidence(member)
                    result = {"kind": "proposal", "target": member["proposalTarget"],
                              "contentUnits": [{"kind": "content.summary",
                              "lines": ["Documents the selected contract."],
                              "claimCategoryId": ref["claimCategoryIds"][0],
                              "evidenceReferenceIds": [ref["evidenceReferenceId"]]}]}
                items.append({"targetId": member["targetId"], "result": result})
            terminal.update(sequence=facts["nextSequence"], items=items)
        calls = [{"id": ("call.finish." if finish else "call.submit.") + str(len(messages)),
                  "type": "function", "function": {"name": "cs_terminal",
                  "arguments": compact(terminal)}}]
        reasoning = "synthetic-campaign-continuation"
    # Artificial codec usage only; never a DeepSeek cost or invoice.
    usage = {"prompt_tokens": 0 if finish else 31,
             "prompt_cache_hit_tokens": 0 if finish else 29,
             "prompt_cache_miss_tokens": 0 if finish else 2,
             "completion_tokens": 0 if finish else 7, "total_tokens": 0 if finish else 38}
    return {"choices": [{"index": 0, "message": {"role": "assistant", "content": None,
            "reasoning_content": reasoning, "tool_calls": calls}, "finish_reason": "tool_calls"}],
            "usage": usage}


def hold_first(index, milliseconds, sleeper=time.sleep):
    require(milliseconds in (0, 61000))
    if index == 1:
        sleeper(milliseconds / 1000)


def private_write(path, value, exclusive=False, immutable=False):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | (os.O_EXCL if exclusive else os.O_TRUNC), 0o600)
    with os.fdopen(fd, "w") as file:
        file.write(compact(value) + "\n")
    if immutable:
        os.chmod(path, 0o400)


def serve(ready, stats, delay):
    counts = {"requests": 0, "responses": 0, "rejected": 0,
              "firstResponseHoldMilliseconds": delay, "externalModelRequests": 0}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass  # Default logs include request URIs; intentionally disabled.

        def do_POST(self):
            self.connection.settimeout(15)
            counts["requests"] += 1
            try:
                require(counts["requests"] <= MAX_CALLS and self.path == "/chat/completions")
                require(not self.headers.get_all("Authorization")
                        and not self.headers.get_all("Proxy-Authorization"))
                require(not self.headers.get_all("Transfer-Encoding")
                        and len(self.headers.get_all("Content-Length", [])) == 1)
                length = self.headers["Content-Length"]
                require(length.isascii() and length.isdigit() and len(length) <= 8
                        and 0 < int(length) <= MAX_BODY)
                require(self.headers.get("Content-Type", "").split(";")[0].strip() == "application/json")
                raw = self.rfile.read(int(length))
                require(len(raw) == int(length))
                body = compact(response(json.loads(raw))).encode("utf-8")
                require(len(body) <= 1048576)
                hold_first(counts["requests"], delay)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                counts["responses"] += 1
            except Exception:
                # Untrusted HTTP/protocol input never reaches traceback/access logs.
                counts["rejected"] += 1
                try:
                    self.send_response(400)
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                except OSError:
                    pass
            finally:
                self.close_connection = True
                private_write(stats, counts)

        def send_error(self, code, *_):
            # No raw request reflection for unsupported methods or malformed headers.
            self.send_response(code)
            self.send_header("Content-Length", "0")
            self.end_headers()
            self.close_connection = True

    server = HTTPServer(("127.0.0.1", 0), Handler)
    # Bound lifetime, including an abandoned runner step. No altered product clocks.
    timer = threading.Timer(600, server.shutdown)
    timer.daemon = True
    timer.start()
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(SystemExit(0)))
    private_write(stats, counts, exclusive=True)
    private_write(ready, {"pid": os.getpid(), "endpoint":
                  "http://127.0.0.1:" + str(server.server_port) + "/chat/completions"},
                  exclusive=True, immutable=True)
    try:
        server.serve_forever(poll_interval=0.1)
    finally:
        timer.cancel()
        server.server_close()
        private_write(stats, counts)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--ready", type=Path, required=True)
    parser.add_argument("--stats", type=Path, required=True)
    parser.add_argument("--first-response-hold-ms", type=int, choices=(0, 61000), required=True)
    arguments = parser.parse_args()
    try:
        serve(arguments.ready, arguments.stats, arguments.first_response_hold_ms)
    except Exception:
        raise SystemExit("Fixed synthetic provider stopped closed") from None
