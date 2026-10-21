#!/usr/bin/env python3
"""
lyt.jp (lyt.sakura.ne.jp) の /home/lyt/www/hayashi/ への自動デプロイスクリプト
"""
import ftplib
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# .env の簡易パース
env_file = os.path.join(BASE_DIR, ".env")
if os.path.isfile(env_file):
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

HOST = os.environ.get("DEPLOY_HOST", "lyt.sakura.ne.jp")
USER = os.environ.get("DEPLOY_USER", "lyt")
PASSWD = os.environ.get("DEPLOY_PASS", "")
REMOTE_TARGET = "hayashi"

UPLOAD_ITEMS = [
    "index.html",
    "style.css",
    "app.js",
    "videos",
]

def main():
    if not PASSWD:
        print("Error: DEPLOY_PASS is not set in .env or environment.")
        sys.exit(1)

    print(f"Connecting to {HOST} as {USER}...")
    ftps = ftplib.FTP_TLS(timeout=20)
    ftps.connect(HOST, 21)
    ftps.auth()
    ftps.login(USER, PASSWD)
    ftps.prot_p()
    print("Authentication successful.")

    root_files = ftps.nlst()
    if "www" in root_files:
        ftps.cwd("www")

    www_files = ftps.nlst()
    if REMOTE_TARGET not in www_files:
        ftps.mkd(REMOTE_TARGET)
    ftps.cwd(REMOTE_TARGET)
    print(f"Deploy target: {ftps.pwd()}")

    def upload_path(local_path, name):
        if os.path.isfile(local_path):
            print(f"Uploading file: {name}")
            with open(local_path, "rb") as f:
                ftps.storbinary(f"STOR {name}", f)
        elif os.path.isdir(local_path):
            remote_items = ftps.nlst()
            if name not in remote_items:
                ftps.mkd(name)
            ftps.cwd(name)
            for sub in sorted(os.listdir(local_path)):
                if sub.startswith("."):
                    continue
                upload_path(os.path.join(local_path, sub), sub)
            ftps.cwd("..")

    for item in UPLOAD_ITEMS:
        local_item = os.path.join(BASE_DIR, item)
        if os.path.exists(local_item):
            upload_path(local_item, item)

    ftps.quit()
    print("Deploy complete!")
    print("URL: https://www.lyt.jp/hayashi/")
    print("URL (sakura): https://lyt.sakura.ne.jp/hayashi/")

if __name__ == "__main__":
    main()
