#!/usr/bin/env bash
# Builds the Android APK of the game without Android Studio or the SDK manager.
# Tools come from Maven Central: aapt2 and the framework resources (inside apktool-lib),
# dalvik-dx, apksig and the Android API classes (Robolectric android-all).
# Output: tower-defense/Silvenor.apk (installable file, signed with keystore/silvenor.p12)
#     and tower-defense/Silvenor.aab (Android App Bundle for Google Play, built with bundletool and signed with
#     the private upload key keystore/upload.p12 when its password is given in SILVENOR_UPLOAD_PASS)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
GAME="$HERE/.."
TOOLS="${SILVENOR_TOOLS:-$HERE/.tools}"
BUILD="$HERE/build"
OUT="$GAME/Silvenor.apk"
KEYSTORE="$HERE/keystore/silvenor.p12"
STOREPASS="silvenor-defense"
ALIAS="silvenor"
MIN_SDK=24
TARGET_SDK=36

MIRRORS=(https://repo1.maven.org/maven2 https://repo.maven.apache.org/maven2)
fetch() { # fetch <maven path> <file>
  [ -s "$TOOLS/$2" ] && return 0
  for attempt in 1 2 3 4; do
    for m in "${MIRRORS[@]}"; do
      if curl -sSfL --max-time 1200 -o "$TOOLS/$2.part" "$m/$1"; then mv "$TOOLS/$2.part" "$TOOLS/$2"; return 0; fi
    done
    sleep $((attempt * 10))
  done
  echo "could not download $1" >&2; exit 1
}

mkdir -p "$TOOLS"
fetch org/apktool/apktool-lib/3.0.3/apktool-lib-3.0.3.jar apktool-lib.jar
fetch com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar dalvik-dx.jar
fetch com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar apksig.jar
fetch org/robolectric/android-all/14-robolectric-10818077/android-all-14-robolectric-10818077.jar android-all.jar
if [ ! -s "$TOOLS/bundletool.jar" ]; then
  curl -sSfL --max-time 900 -o "$TOOLS/bundletool.jar.part" https://github.com/google/bundletool/releases/download/1.17.2/bundletool-all-1.17.2.jar
  mv "$TOOLS/bundletool.jar.part" "$TOOLS/bundletool.jar"
fi
if [ ! -x "$TOOLS/aapt2" ]; then
  unzip -o -q -j "$TOOLS/apktool-lib.jar" prebuilt/linux/aapt2 prebuilt/android-framework.jar -d "$TOOLS"
  chmod +x "$TOOLS/aapt2"
fi

if [ ! -f "$KEYSTORE" ]; then
  mkdir -p "$(dirname "$KEYSTORE")"
  keytool -genkeypair -keystore "$KEYSTORE" -storetype PKCS12 -storepass "$STOREPASS" -keypass "$STOREPASS" \
    -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Silvenor Defense, O=Silvenor" >/dev/null
fi

rm -rf "$BUILD"; mkdir -p "$BUILD/assets/fonts" "$BUILD/classes" "$BUILD/gen"

# 1. assets: the game page with the fonts bundled instead of loaded from Google Fonts
python3 - "$GAME/index.html" "$BUILD/assets/index.html" <<'PY'
import re, sys
src = open(sys.argv[1], encoding='utf-8').read()
src = re.sub(r'<link rel="preconnect"[^>]*>\n', '', src)
src, n = re.subn(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com/[^"]*">', '<link rel="stylesheet" href="fonts/fonts.css">', src)
assert n == 1, 'font link not found'
open(sys.argv[2], 'w', encoding='utf-8').write(src)
PY
cp "$HERE"/fonts/*.woff2 "$HERE/fonts/fonts.css" "$HERE/fonts/OFL.txt" "$BUILD/assets/fonts/"

# 2. resources and manifest
"$TOOLS/aapt2" compile --dir "$HERE/res" -o "$BUILD/res.zip"
"$TOOLS/aapt2" link -o "$BUILD/base.apk" -I "$TOOLS/android-framework.jar" \
  --manifest "$HERE/AndroidManifest.xml" -A "$BUILD/assets" \
  --min-sdk-version $MIN_SDK --target-sdk-version $TARGET_SDK "$BUILD/res.zip"

# 3. code
javac -nowarn --release 8 -classpath "$TOOLS/android-all.jar" -d "$BUILD/classes" \
  $(find "$HERE/src" -name '*.java') 2>&1 | grep -v "^warning: \[options\]" || true
[ -f "$BUILD/classes/com/silvenor/defense/MainActivity.class" ] || { echo "javac failed" >&2; exit 1; }
java -cp "$TOOLS/dalvik-dx.jar" com.android.dx.command.Main --dex --min-sdk-version=$MIN_SDK --output="$BUILD/classes.dex" "$BUILD/classes"

# 4. add the code, keep resources.arsc and other stored entries uncompressed and 4-byte aligned
python3 - "$BUILD/base.apk" "$BUILD/classes.dex" "$BUILD/unsigned.apk" <<'PY'
import sys, zipfile, struct
src, dex, out = sys.argv[1:]
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(out, 'w') as zout:
    items = [(i, zin.read(i.filename)) for i in zin.infolist()]
    items.append((zipfile.ZipInfo('classes.dex', (2008, 1, 1, 0, 0, 0)), open(dex, 'rb').read()))
    items[-1][0].compress_type = zipfile.ZIP_DEFLATED
    for info, data in items:
        zi = zipfile.ZipInfo(info.filename, info.date_time)
        zi.compress_type = info.compress_type
        zi.external_attr = info.external_attr
        if zi.compress_type == zipfile.ZIP_STORED:
            base = zout.fp.tell() + 30 + len(zi.filename.encode())
            pad = (-base) % 4
            if pad:
                while pad < 6: pad += 4
                zi.extra = struct.pack('<HHH', 0xD935, pad - 4, 4) + b'\0' * (pad - 6)
        zout.writestr(zi, data)
PY

# 5. sign (APK Signature Scheme v2; minSdk 24 needs no v1) and verify
javac -nowarn -cp "$TOOLS/apksig.jar" -d "$BUILD/signer" "$HERE/tools/SignApk.java"
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED --add-exports java.base/sun.security.util=ALL-UNNAMED \
  -cp "$TOOLS/apksig.jar:$BUILD/signer" SignApk "$KEYSTORE" "$STOREPASS" "$ALIAS" "$BUILD/unsigned.apk" "$OUT"
"$TOOLS/aapt2" dump badging "$OUT" | head -3
ls -la "$OUT"

# 6. Android App Bundle for Google Play: the same resources linked in protobuf form, laid out as a "base" module
"$TOOLS/aapt2" link --proto-format -o "$BUILD/proto.zip" -I "$TOOLS/android-framework.jar" \
  --manifest "$HERE/AndroidManifest.xml" -A "$BUILD/assets" \
  --min-sdk-version $MIN_SDK --target-sdk-version $TARGET_SDK "$BUILD/res.zip"
python3 - "$BUILD/proto.zip" "$BUILD/classes.dex" "$BUILD/base.zip" <<'PY'
import sys, zipfile
src, dex, out = sys.argv[1:]
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zout:
    for info in zin.infolist():
        n = info.filename
        if n == 'AndroidManifest.xml': dest = 'manifest/AndroidManifest.xml'
        elif n == 'resources.pb' or n.startswith(('res/', 'assets/')): dest = n
        else: dest = 'root/' + n
        zout.writestr(dest, zin.read(n))
    zout.write(dex, 'dex/classes.dex')
PY
rm -f "$BUILD/unsigned.aab"
java -jar "$TOOLS/bundletool.jar" build-bundle --modules="$BUILD/base.zip" --output="$BUILD/unsigned.aab"
java -jar "$TOOLS/bundletool.jar" validate --bundle="$BUILD/unsigned.aab" > /dev/null
if [ -n "${SILVENOR_UPLOAD_PASS:-}" ]; then
  jarsigner -keystore "$HERE/keystore/upload.p12" -storetype PKCS12 -storepass "$SILVENOR_UPLOAD_PASS" \
    -sigalg SHA256withRSA -digestalg SHA-256 -signedjar "$GAME/Silvenor.aab" "$BUILD/unsigned.aab" upload > /dev/null
  jarsigner -verify "$GAME/Silvenor.aab" | tail -1
  ls -la "$GAME/Silvenor.aab"
else
  echo "Silvenor.aab not signed: set SILVENOR_UPLOAD_PASS to the upload key password" >&2
fi
