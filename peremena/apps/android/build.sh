#!/usr/bin/env bash
# Build peremena.apk: apktool assembles res + smali, apksig signs it.
# usage: ./build.sh <tools_dir> <out_dir>
#   tools_dir: apktool.jar (v2.10.0, GitHub releases) and apksig.jar (Maven Central)
#   PEREMENA_KEYSTORE / PEREMENA_KEYPASS: signing key (created on first run if missing)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tools="$(cd "$1" && pwd)"; out="$(mkdir -p "$2" && cd "$2" && pwd)"
ks="${PEREMENA_KEYSTORE:-$out/peremena-release.p12}"; pass="${PEREMENA_KEYPASS:-peremena}"

(cd "$here/../.." && ./build.sh >/dev/null)
mkdir -p "$here/assets"
cp "$here/../../index.html" "$here/assets/index.html"

if [ ! -f "$ks" ]; then
  keytool -genkeypair -keystore "$ks" -storetype PKCS12 -storepass "$pass" -keypass "$pass" -alias peremena \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Peremena, O=School project" >/dev/null 2>&1
fi

java -jar "$tools/apktool.jar" b "$here" -o "$out/peremena-unsigned.apk"
python3 "$here/zipalign.py" "$out/peremena-unsigned.apk" "$out/peremena-aligned.apk"
javac -cp "$tools/apksig.jar" -d "$out" "$here/Sign.java"
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED --add-exports java.base/sun.security.util=ALL-UNNAMED -cp "$tools/apksig.jar:$out" Sign "$ks" "$pass" "$out/peremena-aligned.apk" "$out/Peremena.apk"
rm -f "$out/peremena-unsigned.apk" "$out/peremena-aligned.apk" "$out"/*.class
ls -la "$out/Peremena.apk"
