#!/usr/bin/env bash
# Сборка APK «Мой говорящий Гаппо» без Android Studio и Android SDK.
# Нужны: JDK 17+, Python 3, Node.js (npm). Инструменты скачиваются с Maven Central.
set -euo pipefail
cd "$(dirname "$0")"

B=build
T=$B/tools
M=https://repo1.maven.org/maven2
OUT=../out/gappo.apk
mkdir -p "$T" "$B/classes" ../out

fetch() { # url файл sha1 (суммы сверены с Maven Central)
  if [ ! -s "$2" ]; then
    echo "скачиваю $(basename "$2")"
    for i in 1 2 3 4 5; do curl -fsSL -o "$2.part" "$1" && break; sleep $((i * 2)); done
    mv "$2.part" "$2"
  fi
  echo "$3  $2" | sha1sum -c --quiet
}
fetch $M/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar "$T/dx.jar" \
  71ac16d1f34143d86440fca923422f9c2e2ac403
fetch $M/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar "$T/apksig.jar" \
  6ef7a58375aa68fb492b58edd97607bee8ee5c5c
fetch $M/org/robolectric/android-all/14-robolectric-10818077/android-all-14-robolectric-10818077.jar "$T/android-all.jar" \
  94b1490a891e9be559aa35c87cd8a0c163f32d83

[ -d node_modules/@fontsource ] || npm install --no-audit --no-fund

echo "компилирую Java"
rm -rf "$B/classes" && mkdir -p "$B/classes"
javac -nowarn --release 8 -Xlint:-options -encoding UTF-8 -cp "$T/android-all.jar" -d "$B/classes" src/com/gappo/game/*.java
java -cp "$T/dx.jar" com.android.dx.command.Main --dex --min-sdk-version=24 --output="$B/classes.dex" "$B/classes"

echo "упаковываю APK"
python3 tools/build_apk.py --dex "$B/classes.dex" --out "$B/unsigned.apk"

[ -f debug.keystore ] || keytool -genkeypair -keystore debug.keystore -storetype PKCS12 -storepass android -keypass android \
  -alias gappo -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Gappo Debug"
javac -nowarn -encoding UTF-8 -cp "$T/apksig.jar" -d "$B/signer" tools/Sign.java
# apksig 2.3.0 при загрузке трогает внутренний класс JDK sun.security.x509
java -Dstdout.encoding=UTF-8 --add-exports=java.base/sun.security.x509=ALL-UNNAMED -cp "$B/signer:$T/apksig.jar" Sign "$B/unsigned.apk" "$OUT" debug.keystore android gappo
echo "готово: gappo/out/gappo.apk ($(du -k "$OUT" | cut -f1) КБ)"
