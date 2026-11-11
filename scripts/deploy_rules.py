"""把 firestore.rules 部署到 Firebase（Firebase Rules REST API）。
需要環境變數 FIREBASE_SERVICE_ACCOUNT：服務帳戶金鑰 JSON（角色：Firebase Rules Admin）。"""
import json, os, sys
import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

info = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
project = os.environ.get("FIREBASE_PROJECT_ID") or info["project_id"]
creds = service_account.Credentials.from_service_account_info(
    info, scopes=["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/firebase"])
creds.refresh(Request())
H = {"Authorization": f"Bearer {creds.token}", "Content-Type": "application/json"}
API = f"https://firebaserules.googleapis.com/v1/projects/{project}"
source = open("firestore.rules", encoding="utf8").read()

def fail(msg, r):
    print(f"::error::{msg}：HTTP {r.status_code} {r.text[:1500]}")
    sys.exit(1)

# 1. 建立新的 ruleset（同時做語法檢查）
r = requests.post(f"{API}/rulesets", headers=H, json={"source": {"files": [{"name": "firestore.rules", "content": source}]}})
if r.status_code != 200:
    fail("規則語法錯誤或權限不足", r)
ruleset = r.json()["name"]
print("建立 ruleset", ruleset)

# 2. 讓 Firestore（預設資料庫）使用新 ruleset
rel = f"projects/{project}/releases/cloud.firestore"
r = requests.patch(f"https://firebaserules.googleapis.com/v1/{rel}", headers=H, json={"release": {"name": rel, "rulesetName": ruleset}})
if r.status_code == 404:
    r = requests.post(f"{API}/releases", headers=H, json={"name": rel, "rulesetName": ruleset})
if r.status_code != 200:
    fail("發布規則失敗", r)

# 3. 確認
r = requests.get(f"https://firebaserules.googleapis.com/v1/{rel}", headers=H)
ok = r.status_code == 200 and r.json().get("rulesetName") == ruleset
print(("::notice::Firestore 安全規則已更新為 " if ok else "::error::無法確認規則版本 ") + ruleset)
sys.exit(0 if ok else 1)
