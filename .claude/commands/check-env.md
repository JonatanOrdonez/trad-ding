# Check environment variables

Validate that all required environment variables are present and that external services are reachable before running the project.

---

## 1. Verify the `.env` file exists

```bash
ls -la .env
```

If it does not exist, copy the example and fill it in:

```bash
cp .env.example .env   # if an example exists
# or create it manually — see README.md for required variables
```

---

## 2. Check all required variables are set

```bash
source .venv/bin/activate

python3 - <<'EOF'
import os
from dotenv import load_dotenv
load_dotenv()

required = [
    "DB_USER", "DB_PASSWORD", "DB_HOST", "DB_PORT", "DB_NAME",
    "NEWS_API_KEY", "GROQ_API_KEY",
    "SUPABASE_URL", "SUPABASE_KEY",
]

missing = [k for k in required if not os.getenv(k)]

if missing:
    print("❌ Missing variables:")
    for k in missing:
        print(f"   - {k}")
else:
    print("✅ All required environment variables are set.")
EOF
```

---

## 3. Test database connectivity

```bash
python3 - <<'EOF'
import os
from dotenv import load_dotenv
load_dotenv()

import psycopg2

try:
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT", 5432),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        dbname=os.getenv("DB_NAME"),
        connect_timeout=5,
    )
    conn.close()
    print("✅ Database connection OK")
except Exception as e:
    print(f"❌ Database connection failed: {e}")
EOF
```

> **Common fix:** If `could not translate host name ... to address` appears, your `DB_HOST` is wrong or your internet/VPN is blocking the connection. Try using the direct Supabase host (port 5432) instead of the pooler.

---

## 4. Test Groq API key

```bash
python3 - <<'EOF'
import os
from dotenv import load_dotenv
load_dotenv()

from groq import Groq

try:
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    models = client.models.list()
    print(f"✅ Groq API OK — {len(models.data)} models available")
except Exception as e:
    print(f"❌ Groq API failed: {e}")
EOF
```

---

## 5. Test NewsAPI key

```bash
python3 - <<'EOF'
import os, urllib.request, json
from dotenv import load_dotenv
load_dotenv()

key = os.getenv("NEWS_API_KEY")
url = f"https://newsapi.org/v2/top-headlines?country=us&pageSize=1&apiKey={key}"
try:
    with urllib.request.urlopen(url, timeout=5) as r:
        data = json.loads(r.read())
    if data.get("status") == "ok":
        print("✅ NewsAPI key OK")
    else:
        print(f"❌ NewsAPI error: {data.get('message')}")
except Exception as e:
    print(f"❌ NewsAPI request failed: {e}")
EOF
```

---

## 6. Test Supabase connectivity

```bash
python3 - <<'EOF'
import os
from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

try:
    client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    # List buckets to confirm storage access
    buckets = client.storage.list_buckets()
    names = [b.name for b in buckets]
    print(f"✅ Supabase OK — buckets: {names}")
except Exception as e:
    print(f"❌ Supabase connection failed: {e}")
EOF
```

---

## 7. Quick health check (server must be running)

```bash
curl -s http://localhost:8000/health | python3 -m json.tool
```

If the server is not running yet, use `/run-project` first.

---

## Summary

| Check | Command |
|---|---|
| Variables set | Step 2 above |
| DB reachable | Step 3 above |
| Groq working | Step 4 above |
| NewsAPI working | Step 5 above |
| Supabase working | Step 6 above |
| Server healthy | `curl localhost:8000/health` |
